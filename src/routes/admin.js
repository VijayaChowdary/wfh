const express = require('express');
const { Op, fn, col } = require('sequelize');
const router = express.Router();
const { Contract, Job } = require('../model');

// Return the profession that earned the most money in a specified time range
router.get('/best-profession', async (req, res) => {
  const { Profile, sequelize } = req.app.get('models');
  const { start_date, end_date } = req.query;

  const result = await Job.findAll({
    attributes: ['Contract.Contractor.profession', [fn('sum', col('price')), 'total_earnings']],
    include: [
      {
        model: Contract,
        where: {
          status: 'terminated',
          paymentDate: {
            [Op.between]: [start_date, end_date],
          },
        },
        include: [Profile, { model: Profile, as: 'Contractor' }],
      },
    ],
    group: ['Contract.Contractor.profession'],
    order: [[fn('sum', col('price')), 'DESC']],
    limit: 1,
  });

  res.json(result);
});

// Return the clients who paid the most for jobs in a specified time range
router.get('/best-clients', async (req, res) => {
  const { Profile, sequelize } = req.app.get('models');
  const { start_date, end_date } = req.query;

  const result = await Job.findAll({
    attributes: ['Contract.Client.id', [fn('sum', col('price')), 'total_payments']],
    include: [
      {
        model: Contract,
        where: {
          status: 'terminated',
          paymentDate: {
            [Op.between]: [start_date, end_date],
          },
        },
        include: [Profile, { model: Profile, as: 'Client' }],
      },
    ],
    group: ['Contract.Client.id'],
    order: [[fn('sum', col('price')), 'DESC']],
    limit: 10,
  });

  res.json(result);
});


module.exports = router;
