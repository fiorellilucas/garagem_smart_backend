select 
	e.id as id_estabelecimento,
	e.nome_estabelecimento,
	g.id as id_garagem,
	g.nome_garagem,
	v.id as id_vaga,
	v.numero_vaga,
	v.status,
	v.tipo_vaga
from "Vaga" v
inner join "Garagem" g on g.id = v.id_garagem 
inner join "Estabelecimento" e on e.id = g.id_estabelecimento
where e.id = $1