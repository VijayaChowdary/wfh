const express = require('express');
const bodyParser = require('body-parser');
const {sequelize} = require('./model')
const {getProfile} = require('./middleware/getProfile')
const contractsRouter = require('./routes/contracts')
const jobsRouter = require('./routes/jobs')
const adminRouter = require('./routes/admin')
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)


app.use('./contracts', contractsRouter);
app.use('/jobs', jobsRouter);
app.use('/admin', adminRouter)



/**
 * FIX ME!
 * @returns contract by id
 */
// app.get('/contracts/:id',getProfile ,async (req, res) =>{
//     const {Contract} = req.app.get('models')
//     const {id} = req.params
//     const contract = await Contract.findOne({where: {id}})
//     if(!contract) return res.status(404).end()
//     res.json(contract)
// })

app.listen(3001, ()=> {
    console.log("App listing at the port 3001")
})
module.exports = app;
