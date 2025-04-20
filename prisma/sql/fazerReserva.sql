with cte_estabelecimento as (
	select e.valor_estacionamento 
	from "Estabelecimento" e 
	where e.id = (
		select g.id_estabelecimento 
		from "Garagem" g 
		where g.id = $1
	)
)
insert into "Reserva" 
select  
	(max(r.id) + 1) as novo_id,
	now(),
	now(),
	now() + interval '1 hour',
	'ativa',
	e.valor_estacionamento,
	$2,
	2 -- trocar depois o id pessoa
from "Reserva" r, cte_estabelecimento e
group by e.valor_estacionamento;