const { PrismaClient } = require('@prisma/client')
const { getEstabelecimentosComValor } = require('@prisma/client/sql')
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const SECRET = process.env.JWT_SECRET || '5e7facd7104e2cdca02cfe7bc6100ada'
const app = express()
const port = 3000
const prisma = new PrismaClient()

app.use(cors())

const jsonParser = bodyParser.json()

function autenticarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) return res.status(401).json({ erro: 'Token não fornecido' });

  jwt.verify(token, SECRET, (err, usuario) => {
    if (err) return res.status(403).json({ erro: 'Token inválido' });

    req.usuario = usuario;
    next();
  });
}

app.get('/api/perfil', autenticarToken, async (req, res) => {
  const usuarioId = req.usuario.id;

  const dados = await prisma.pessoa.findUnique({
    where: { id: usuarioId },
    select: { nome: true, email: true, tipo_pessoa: true }
  });

  res.json(dados);
});

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
      garagens: {
        select: {
          id: true,
          nome_garagem: true,
          vagas: {
            select: {
              id: true,
              numero_vaga: true,
              tipo_vaga: true,
              status: true
            }
          }
        }
      }
    },
    where: {
      id: id_estabelecimento
    }
  })

  res.json(reservation_modal_data[0])
})

app.post('/api/make_reservation', jsonParser, async (req, res) => {
  const id_vaga = Number(req.body["id_vaga"])

  const agora = new Date();

  const vagaComGaragem = await prisma.vaga.findUnique({
    where: { id: id_vaga },
    include: {
      garagem: {
        include: {
          estabelecimento: true
        }
      }
    }
  });

  const valorEstacionamento = vagaComGaragem.garagem.estabelecimento.valor_estacionamento;

  await prisma.reserva.create({
    data: {
      dthr_reserva: agora,
      dthr_entrada: agora,
      dthr_saida: new Date(agora.getTime() + 60 * 60 * 1000),
      id_pessoa: 2,
      id_vaga: id_vaga,
      status_reserva: "ativa",
      valor_pago: valorEstacionamento
    }
  });

  await prisma.vaga.update({
    where: {
      id: id_vaga
    },
    data: {
      status: 'ocupada'
    }
  })

  res.status(200)
})

app.post('/api/cadastro', jsonParser, async (req, res) => {
  try {
    const {
      nome,
      email,
      cpf,
      senha,
      cidade,
      estado,
      dt_nascimento,
      telefone,
      tipo_pessoa = "cliente",
      id_plano = 1
    } = req.body

    const emailExistente = await prisma.pessoa.findUnique({ where: { email } })
    const cpfExistente = await prisma.pessoa.findUnique({ where: { cpf } })

    if (emailExistente || cpfExistente) {
      return res.status(400).json({ erro: "E-mail ou CPF já cadastrado." })
    }

    const senhaHash = await bcrypt.hash(senha, 10)

    const novaPessoa = await prisma.pessoa.create({
      data: {
        nome,
        email,
        cpf,
        senha: senhaHash,
        cidade,
        estado,
        dt_nascimento: new Date(dt_nascimento),
        telefone,
        tipo_pessoa,
        id_plano
      }
    })

    res.status(201).json({ mensagem: "Usuário cadastrado com sucesso!", id: novaPessoa.id })
  } catch (err) {
    console.error(err)
    res.status(500).json({ erro: "Erro ao registrar usuário." })
  }
})

app.post('/api/login', jsonParser, async (req, res) => {
  try {
    const { email, senha } = req.body

    const usuario = await prisma.pessoa.findUnique({ where: { email } })

    if (!usuario) {
      return res.status(404).json({ erro: "Usuário não encontrado." })
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha)
    if (!senhaCorreta) {
      return res.status(401).json({ erro: "Senha inválida." })
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        nome: usuario.nome,
        tipo_pessoa: usuario.tipo_pessoa
      },
      SECRET,
      { expiresIn: '2h' }
    )

    res.status(200).json({ mensagem: "Login bem-sucedido", token })
  } catch (err) {
    console.error(err)
    res.status(500).json({ erro: "Erro ao realizar login." })
  }
})

app.listen(port, () => {
  console.log(`Porta : ${port}`)
})