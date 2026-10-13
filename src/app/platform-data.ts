export type Person={name:string;handle:string;initials:string;region:string;status:string;color:string;skills:string[];bio:string;projects:number};
export type Project={id:string;title:string;category:string;region:string;status:string;summary:string;progress:number;openTasks:number;people:number;tasks:string[];accent:string;icon:string};
export type Product={id:string;slug?:string;name:string;owner:string;ownerHandle:string;region?:string;category:string;description:string;price:string;mark:string;condition?:string;stock?:number;membershipEligible?:boolean;checkoutEnabled?:boolean};
export const people:Person[]=[
{name:'Francois Kamffer',handle:'@fr333man',initials:'FK',region:'Randburg',status:'LIVENESS CHECKED',color:'#e9b63c',skills:['Research','Water','Broadcasting'],bio:'Maker, independent researcher and host of respectful, evidence-led conversations.',projects:3},
{name:'Amina Dlamini',handle:'@amina.builds',initials:'AD',region:'Johannesburg',status:'MEMBER WITNESSED',color:'#28a887',skills:['Water systems','Logistics','Community'],bio:'Coordinates practical water resilience projects and turns plans into field work.',projects:4},
{name:'Thandi Mokoena',handle:'@soil.sister',initials:'TM',region:'Gauteng',status:'LIVENESS CHECKED',color:'#709b48',skills:['Soil biology','Food growing','Training'],bio:'Teaches living-soil practice and supports neighbourhood compost circles.',projects:2},
{name:'Kabelo Nkosi',handle:'@kabelo.offgrid',initials:'KN',region:'West Rand',status:'MEMBER WITNESSED',color:'#cf6e3a',skills:['Solar','Electrical','Workshops'],bio:'Off-grid builder helping people understand and maintain their own energy systems.',projects:5},
{name:'Lerato Botha',handle:'@lerato.stories',initials:'LB',region:'Pretoria',status:'LIVENESS CHECKED',color:'#5a79bd',skills:['Video','Interviewing','Editing'],bio:'Documents useful local work and helps members broadcast across platforms.',projects:3},
];
export const projects:Project[]=[
{id:'water-resilience',title:'Neighbourhood Water Resilience',category:'WATER',region:'West Rand',status:'ACTIVE',summary:'Map, test and maintain shared safe-water collection points with public reporting.',progress:68,openTasks:3,people:18,tasks:['Confirm Saturday test route','Lead volunteer briefing','Document maintenance guide'],accent:'#168f9a',icon:'≈'},
{id:'soil-circles',title:'Living Soil Circles',category:'FOOD & SOIL',region:'Gauteng',status:'ACTIVE',summary:'Start community compost and soil-learning circles using locally available biology.',progress:44,openTasks:5,people:27,tasks:['Host first compost demo','Translate quick-start guide','Source three test beds'],accent:'#638c43',icon:'✦'},
{id:'open-energy',title:'Open Energy Workshop',category:'ENERGY',region:'Remote / united',status:'RECRUITING',summary:'A practical course for understanding, sizing and maintaining small solar systems.',progress:25,openTasks:6,people:12,tasks:['Review safety module','Film battery lesson','Build parts calculator'],accent:'#d98b2c',icon:'☀'},
{id:'oral-history',title:'West Rand Oral History',category:'KNOWLEDGE',region:'Krugersdorp',status:'PLANNING',summary:'Record, transcribe and preserve first-hand community accounts with clear consent.',progress:12,openTasks:4,people:8,tasks:['Draft interview consent','Book first two guests','Define archive format'],accent:'#735ca8',icon:'◉'},
];
export const products:Product[]=[
{id:'cdswater',name:'CDSwater purification kit',owner:'Francois Kamffer',ownerHandle:'@fr333man',category:'Water',description:'A practical home water-treatment kit with instructions and responsible-use guidance.',price:'R 480',mark:'CDS'},
{id:'npk432',name:'NPK432 biological starter',owner:'Francois Kamffer',ownerHandle:'@fr333man',category:'Soil',description:'Clean mealworm frass for compost activation and living-soil applications.',price:'R 220',mark:'432'},
{id:'solar-workshop',name:'Know Your Solar workshop',owner:'Kabelo Nkosi',ownerHandle:'@kabelo.offgrid',category:'Learning',description:'A three-hour practical introduction to panels, batteries, safety and system sizing.',price:'R 350',mark:'SUN'},
{id:'fido-treats',name:'Fido natural dog treats',owner:'Amina Dlamini',ownerHandle:'@amina.builds',category:'Pets',description:'Small-batch dog treats for training, walks and market-day rewards.',price:'R 85',mark:'FIDO'},
];
