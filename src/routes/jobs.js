const express = require('express');
const router = express.Router();
const { Job } = require('../model');
const { getProfile } = require('../middleware/getProfile');

// Get all unpaid jobs for a user in active contracts
router.get('/unpaid', getProfile, async (req, res) => {
  const { Contract, Profile } = req.app.get('models');
  const jobs = await Job.findAll({
    where: {
      paid: false,
      '$Contract.status$': 'in_progress',
      [Op.or]: [{ '$Contract.Client.id$': req.profile.id }, { '$Contract.Contractor.id$': req.profile.id }],
    },
    include: [{ model: Contract, include: [Profile, { model: Profile, as: 'Contractor' }] }],
  });

  res.json(jobs);
});

// Pay for a job, ensuring the client's balance is sufficient
router.post('/:job_id/pay', getProfile, async (req, res) => {
  const { Job, Profile } = req.app.get('models');
  const { job_id } = req.params;
  const job = await Job.findOne({
    where: { id: job_id, paid: false },
    include: [{ model: Profile, include: [{ model: Job }] }],
  });

  if (!job) return res.status(404).end();

  const client = job.Contract.Client;
  if (client.balance >= job.price) {
    client.balance -= job.price;
    job.paid = true;
    job.paymentDate = new Date();
    await Promise.all([client.save(), job.save()]);
    return res.json({ message: 'Payment successful' });
  } else {
    return res.status(400).json({ message: 'Insufficient balance' });
  }
});


module.exports = router;
