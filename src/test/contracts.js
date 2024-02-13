const chai = require('chai');
const chaiHttp = require('chai-http');
const { sequelize } = require('../src/model');
const seedDb = require('../scripts/seedDb');
const app = require('../src/app');

chai.use(chaiHttp);
const { expect } = chai;

describe('Contracts API', () => {
  let authToken;
  let contract;

  before(async () => {
    await seedDb();

    const res = await chai.request(app).post('/auth').send({ username: 'testUser', password: 'testPassword' });
    authToken = res.body.token;

    const createContractRes = await chai.request(app)
      .post('/contracts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        terms: 'Sample terms',
        status: 'in_progress',
        ClientId: 1,
        ContractorId: 5,
      });

    contract = createContractRes.body;
  });

  describe('GET /contracts/:id', () => {
    it('should return a contract if it belongs to the calling profile', async () => {
      const res = await chai.request(app)
        .get(`/contracts/${contract.id}`)
        .set('profile_id', '1')  

      expect(res).to.have.status(200);
      expect(res.body).to.be.an('object');
      expect(res.body.id).to.equal(contract.id);
    });

    it('should handle the case where the contract does not belong to the calling profile', async () => {
      const res = await chai.request(app)
        .get(`/contracts/${contract.id}`)
        .set('profile_id', '2');  

      expect(res).to.have.status(404);
    });
  });


  after(async () => {
    await sequelize.close();
  });
});
