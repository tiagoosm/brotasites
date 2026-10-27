# Categories, families and rules

The catalog works with 10 families. The category the client picks only selects the family and tunes the vocabulary. Anyone who does not fit goes to "Outro", with mandatory manual review.

Category labels and button texts are product copy, so they stay in pt-BR.

## Families

| Family (id) | pt-BR label | Default CTA | Sections on by default | Extra field | Review |
| --- | --- | --- | --- | --- | --- |
| `food` | Alimentação | "Pedir pelo WhatsApp" | hero, servicos (products), galeria, contato | Order lead time (optional) | Standard |
| `beauty` | Beleza e bem-estar | "Marcar horário" | hero, servicos, galeria, sobre, contato | Image authorization | Standard |
| `health` | Saúde regulada | "Agendar contato" | hero, servicos, sobre, contato | Professional registration | Mandatory |
| `automotive` | Automotivo | "Pedir orçamento" | hero, servicos, galeria, contato | | Standard |
| `home-services` | Casa e serviços técnicos | "Pedir orçamento" | hero, servicos, como-funciona, galeria, contato | Service area | Reinforced for risky categories |
| `retail` | Comércio local | "Falar com a loja" | hero, diferenciais, sobre, contato | Instagram or catalog link | Standard |
| `education` | Educação e aulas | "Aula experimental" | hero, servicos (classes), sobre, contato | Confirmation for photos of minors | Standard |
| `professionals` | Profissionais liberais | "Falar com o profissional" | hero, servicos, sobre, faq, contato | Registration when applicable | Reinforced for law and consulting |
| `events-creative` | Eventos e criativos | "Pedir orçamento" | hero, galeria, servicos, sobre, contato | Image authorization | Standard |
| `pet-agro-institutions` | Pet, agro e instituições | "Falar pelo WhatsApp" | hero, servicos, galeria, contato | | Standard; institutions without donations |

## Example categories per family

Initial taxonomy, to be expanded in `packages/schema/src/categories.ts`:

- **Alimentação:** padaria, confeitaria e bolos por encomenda, doces por encomenda, marmitaria, cafeteria, açaí e sorveteria, food truck, lanchonete e hamburgueria, pizzaria, restaurante e self-service, hortifrúti e açougue.
- **Beleza:** salão de beleza, barbearia, manicure e pedicure, sobrancelha e cílios, maquiadora, estética facial e corporal, massagem e spa, depilação, studio de tatuagem e piercing.
- **Saúde regulada:** dentista, fisioterapia, psicologia, nutrição, fonoaudiologia, veterinário, clínica médica pequena, terapias integrativas, pilates e personal trainer (CREF registration).
- **Automotivo:** oficina mecânica, funilaria e pintura, auto elétrica, lava-jato e estética automotiva, borracharia e troca de óleo, martelinho de ouro e polimento, som e insulfilme, vidraçaria automotiva, oficina de moto, autoescola, autopeças, guincho.
- **Casa e serviços técnicos:** eletricista, encanador, pintor e reformas, marcenaria, serralheria e vidraçaria, ar-condicionado, limpeza, jardinagem e paisagismo, piscineiro, assistência técnica, dedetização, mudanças e fretes, chaveiro, desentupidora, energia solar, câmeras e segurança.
- **Comércio local:** floricultura, presentes e personalizados, papelaria, roupas e boutique, calçados, joalheria e semijoias, ótica, brechó, móveis e decoração, material de construção, celulares, perfumaria, livraria e sebo, artigos de festa, adega.
- **Educação:** reforço escolar, idiomas, música, dança, artes marciais, escolinha de esportes, natação, academia pequena, cursos profissionalizantes, preparatório, creche e berçário.
- **Profissionais:** contador, arquiteto e interiores, fotógrafo e videomaker, despachante, corretor de imóveis, corretor de seguros, advogado, engenheiro e técnico, consultor e coach, tradutor, agência de viagens, personal organizer e cuidadores.
- **Eventos e criativos:** buffet e festas infantis, espaço de eventos, DJ e sonorização, decoração e cerimonial, aluguel de mesas, cadeiras e brinquedos, salgados e doces para festas, fotógrafo de eventos e newborn, barman, artesanato e ateliê, personalizados e estamparia, oficinas, turismo local, pousada e chalé.
- **Pet, agro e instituições:** banho e tosa, pet shop, hotel e creche pet, adestrador e passeador, agropecuária, produtor rural, feiras, igreja e templo, ONG e associações.

## Blocked (the form refuses, explains kindly and charges nothing)

Betting and gambling; adult content; sale of weapons and ammunition; controlled medicines and unregistered online pharmacies; e-cigarettes and tobacco; pyramid schemes, guaranteed income, miracle investments and unregistered crypto; loans, payroll loans, debt collection and "limpa nome"; get-rich-quick courses; imitation of a bank, government body, brand or well-known site; fake tech support; replicas and counterfeits; sale of followers, accounts or reviews; electoral advertising; any content sexualizing minors (block and report).

## Reinforced review (never published without human review)

Chaveiro, guincho, desentupidora, mudanças e fretes, regulated health, supplements, law, consulting and coaching, alcoholic beverages, caregivers, the "Outro" category.

## Rules by topic

- **Regulated health:** require the professional registration and show it in the footer. The AI never promises a cure or a result, never compares, never says "o melhor". Testimonials blocked for psychology and under review for the others. No "before and after" and no photos of patients. Advertising by these professionals is regulated by their councils: confirm with legal counsel before opening (wave 3).
- **Aesthetics:** no generated "before and after", no promised results.
- **Minors:** a photo showing the face of a child or teenager only with the guardians' authorization confirmed. The AI never generates nor picks photos of minors.
- **Donations:** no Pix key, bank account or donate button in the MVP. An external link given by the client, with manual review.
- **Food:** never claim "sem glúten", "vegano", "sem açúcar" or "natural" without the client saying so; never invent health inspection seals.
- **Launch waves:** wave 1 food, beauty, automotive, home services, events and creatives (except reinforced-review categories). Wave 2 education, selected retail, pet and agro, low-risk professionals. Wave 3 regulated health and reinforced review, only after legal validation.
