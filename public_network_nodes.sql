-- Extract unique supply nodes (PORTS)
insert into public.network_nodes (node_type, entity_id, name)
select 'SUPPLY_GATEWAY' as node_type, Min(id) as entity_id, port as name -- Using the first occurrence as the reference ID
from import.imports_at_principal_commodity_level 
where port is not null Group by port;

-- Extract unique demand nodes (RTO)
insert into public.network_nodes (node_type, entity_id, name)
select 'DEMAND_HUB' as node_type, Min(id) as entity_id,
CONCAT(office_name, ' - ', state_name) as name -- Unique name including state to avoid overlap
from vahan4dashboard.vahan_vehicle_registrations_by_fuel_type
where office_name is not null group by office_name, state_name;