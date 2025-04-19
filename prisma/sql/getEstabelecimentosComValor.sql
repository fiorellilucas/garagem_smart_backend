select
    e.id as key,
	e.nome_estabelecimento,
	concat(e.endereco, ' - ', e.cidade, '/', e.estado) endereco,
	e.valor_estacionamento,
	count(v.status)::int as vagas_disponiveis
from "Estabelecimento" e
inner join "Garagem" g on g.id_estabelecimento = e.id
inner join "Vaga" v on v.id_garagem = g.id 
where v.status = 'livre'
group by e.id
order by random()
limit 2