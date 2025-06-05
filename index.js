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

app.post('/api/fazer-reserva', jsonParser, async (req, res) => {
  const id_vaga = Number(req.body["id_vaga"])
  const id_pessoa = Number(req.body["id_pessoa"])

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
      id_pessoa: id_pessoa,
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

    res.status(200).json({
      mensagem: "Login bem-sucedido",
      token,
      id_pessoa: usuario.id
    });
  } catch (err) {
    console.error(err)
    res.status(500).json({ erro: "Erro ao realizar login." })
  }
})

app.get('/api/minhas-reservas', autenticarToken, async (req, res) => {
  const usuarioId = req.usuario.id;

  const reservas = await prisma.reserva.findMany({
    where: { id_pessoa: usuarioId },
    select: {
      id: true,
      dthr_reserva: true,
      status_reserva: true,
      vaga: {
        select: {
          numero_vaga: true,
          garagem: {
            select: {
              nome_garagem: true,
              estabelecimento: {
                select: { nome_estabelecimento: true }
              }
            }
          }
        }
      }
    }
  });

  const resultado = reservas.map(r => ({
    id: r.id,
    dthr_reserva: r.dthr_reserva,
    status: r.status_reserva,
    vaga: r.vaga.numero_vaga,
    garagem: r.vaga.garagem.nome_garagem,
    estabelecimento: r.vaga.garagem.estabelecimento.nome_estabelecimento
  }));

  res.json(resultado);
});

app.delete('/api/reservas/:id', autenticarToken, async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.usuario.id;

  const reserva = await prisma.reserva.findUnique({
    where: { id: Number(id) },
    include: { pessoa: true, vaga: true }  
  });

  if (!reserva || reserva.id_pessoa !== usuarioId) {
    return res.status(403).json({ erro: 'Reserva não encontrada ou não autorizada' });
  }

  await prisma.vaga.update({
    where: { id: reserva.id_vaga },
    data: { status: 'livre' }
  });

  await prisma.reserva.delete({
    where: { id: Number(id) }
  });

  res.json({ mensagem: 'Reserva cancelada com sucesso e vaga liberada' });
});



app.listen(port, () => {
  console.log(`Porta : ${port}`)
})