const { PrismaClient } = require('@prisma/client')
const { getEstabelecimentosComValor } = require('@prisma/client/sql')
const express = require('express')
const cors = require('cors')

const app = express()
const port = 3000
const prisma = new PrismaClient()

app.use(cors())

app.get('/', (req, res) => {
  res.send('hello world')
})

app.get('/api', (req, res) => {
  res.json('hello world api')
})

app.get('/api/estabelecimentos', async (req, res) => {
  const estabelecimentos = await prisma.estabelecimento.findMany()
  res.send(estabelecimentos)
})

app.get('/api/estabelecimentos/enderecos', async (req, res) => {
  const estabelecimentos = await prisma.estabelecimento.findMany({ 
    select: { 
      "endereco": true 
    } 
  })
  res.send(estabelecimentos)
})

app.get('/api/reservation_card', async (req, res) => {
  const reservation_card_data = await prisma.$queryRawTyped(getEstabelecimentosComValor())
  res.json(reservation_card_data)
})

app.listen(port, () => {
  console.log(`Porta : ${port}`)
})