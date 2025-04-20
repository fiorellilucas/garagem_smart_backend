const { PrismaClient } = require('@prisma/client')
const { getEstabelecimentosComValor, fazerReserva } = require('@prisma/client/sql')
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')

const app = express()
const port = 3000
const prisma = new PrismaClient()

app.use(cors())

const jsonParser = bodyParser.json()

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

app.get('/api/reservation_modal', async (req, res) => {
  const id_estabelecimento = Number(req.query["id"])

  const reservation_modal_data = await prisma.estabelecimento.findMany({
    select: {
      id: true,
      nome_estabelecimento: true,
      garagens: {select: {
        id: true,
        nome_garagem: true,
        vagas: {select: {
          id: true,
          numero_vaga: true, 
          tipo_vaga: true,
          status: true
        }}
      }}
    },
    where: {
      id: id_estabelecimento
    }
  })

  res.json(reservation_modal_data[0])
})

app.post('/api/make_reservation', jsonParser, async (req, res) => {
  const id_garagem = Number(req.body["id_garagem"])
  const id_vaga = Number(req.body["id_vaga"])

  await prisma.$queryRawTyped(fazerReserva(id_garagem, id_vaga))

  res.send(200)
})

app.listen(port, () => {
  console.log(`Porta : ${port}`)
})