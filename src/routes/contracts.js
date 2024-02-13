const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { Contract, Job, Profile, sequelize } = require('../model');
const { getProfile } = require('../middleware/getProfile');

// GET /contracts/:id
router.get('/:id', getProfile, async (req, res) => {
  const { Contract } = req.app.get('models');
  const { id } = req.params;
  const contract = await Contract.findOne({
    where: {
      id,
      [Op.or]: [{ '$Client.id$': req.profile.id }, { '$Contractor.id$': req.profile.id }],
    },
    include: [
      { model: Job, where: { paid: false } },
      { model: req.app.get('models').Profile, as: 'Client' },
      { model: req.app.get('models').Profile, as: 'Contractor' },
    ],
  });

  if (!contract) return res.status(404).end();
  res.json(contract);
});

// GET /contracts
router.get('/', getProfile, async (req, res) => {
  const contracts = await Contract.findAll({
    where: {
      [Op.or]: [{ ClientId: req.profile.id }, { ContractorId: req.profile.id }],
      status: { [Op.not]: 'terminated' },
    },
  });

  res.json(contracts);
});

// GET /jobs/unpaid
router.get('/jobs/unpaid', getProfile, async (req, res) => {
  const jobs = await Job.findAll({
    where: {
      paid: false,
    },
    include: [
      {
        model: Contract,
        where: {
          status: 'in_progress',
          [Op.or]: [{ ClientId: req.profile.id }, { ContractorId: req.profile.id }],
        },
      },
    ],
  });

  res.json(jobs);
});

// POST /jobs/:job_id/pay
router.post('/jobs/:job_id/pay', getProfile, async (req, res) => {
  const { job_id } = req.params;
  const job = await Job.findOne({
    where: {
      id: job_id,
      paid: false,
    },
    include: [
      {
        model: Contract,
        include: [
          { model: Profile, as: 'Client' },
          { model: Profile, as: 'Contractor' },
        ],
      },
    ],
  });

  if (!job) return res.status(404).json({ error: 'Job not found or already paid' });

  const client = job.Contract.Client;
  const contractor = job.Contract.Contractor;

  if (client.id !== req.profile.id) {
    return res.status(403).json({ error: 'You are not authorized to pay for this job' });
  }

  if (client.balance < job.price) {
    return res.status(400).json({ error: 'Insufficient funds' });
  }

  // Perform the payment
  await Profile.update(
    { balance: client.balance - job.price },
    { where: { id: client.id } }
  );
  await Profile.update(
    { balance: contractor.balance + job.price },
    { where: { id: contractor.id } }
  );

  // Mark the job as paid
  await Job.update({ paid: true, paymentDate: new Date() }, { where: { id: job.id } });

  res.json({ success: true });
});

// POST /balances/deposit/:userId
router.post('/balances/deposit/:userId', getProfile, async (req, res) => {
  const { userId } = req.params;
  const { amount } = req.body;

  if (req.profile.id !== parseInt(userId)) {
    return res.status(403).json({ error: 'You are not authorized to deposit into this account' });
  }

  const client = await Profile.findByPk(userId);

  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }

  // Check if the deposit exceeds 25% of the total jobs to pay
  const totalJobsToPay = await client.countJobs({ where: { paid: false } });
  const twentyFivePercentLimit = totalJobsToPay * 0.25;

  if (amount > twentyFivePercentLimit) {
    return res.status(400).json({ error: 'Deposit exceeds 25% of the total jobs to pay' });
  }

  // Perform the deposit
  await Profile.update(
    { balance: client.balance + amount },
    { where: { id: client.id } }
  );

  res.json({ success: true });
});

// GET /admin/best-profession?start=<date>&end=<date>
router.get('/admin/best-profession', async (req, res) => {
  const { start, end } = req.query;

  const result = await sequelize.query(
    `SELECT "Contractor"."profession", SUM("Job"."price") AS "earnings"
    FROM "Profiles" AS "Contractor"
    INNER JOIN "Contracts" ON "Contractor"."id" = "Contracts"."ContractorId"
    INNER JOIN "Jobs" ON "Contracts"."id" = "Jobs"."ContractId"
    WHERE "Contracts"."status" = 'terminated' AND "Jobs"."paymentDate" BETWEEN :start AND :end
    GROUP BY "Contractor"."profession"
    ORDER BY "earnings" DESC
    LIMIT 1`,
    {
      type: sequelize.QueryTypes.SELECT,
      replacements: { start, end },
    }
  );

  res.json(result[0] || {});
});

// GET /admin/best-clients?start=<date>&end=<date>&limit=<integer>
router.get('/admin/best-clients', async (req, res) => {
  const { start, end, limit = 2 } = req.query;

  const result = await sequelize.query(
    `SELECT "Client"."firstName", "Client"."lastName", SUM("Job"."price") AS "totalPaid"
    FROM "Profiles" AS "Client"
    INNER JOIN "Contracts" ON "Client"."id" = "Contracts"."ClientId"
    INNER JOIN "Jobs" ON "Contracts"."id" = "Jobs"."ContractId"
    WHERE "Contracts"."status" = 'terminated' AND "Jobs"."paymentDate" BETWEEN :start AND :end
    GROUP BY "Client"."id"
    ORDER BY "totalPaid" DESC
    LIMIT :limit`,
    {
      type: sequelize.QueryTypes.SELECT,
      replacements: { start, end, limit },
    }
  );

  res.json(result);
});

module.exports = router;
