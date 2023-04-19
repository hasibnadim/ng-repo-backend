require('dotenv').config()
const express = require('express')
const app = express()
var cors = require('cors')
const {contributor,contributorRepos,repoDetails} = require('./Controller/Contributors');




app.use(cors())

app.get('/contributors', contributor)
app.get('/contributors/:login', contributorRepos)
app.get('/repo/:owner_name/:rname', repoDetails)

app.listen(3000)