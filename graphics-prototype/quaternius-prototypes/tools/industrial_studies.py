"""Original static process equipment around genuine Quaternius architectural shells.
Visual studies only; canonical catalog/economy definitions live elsewhere.
"""
def assemble(id,c):
 shell,cube,pipe,axis,beam,robot,glass,level=[c[k]for k in ['shell','cube','pipe','axis','beam','robot','glass','level']]
 if id=='acidWorks':
  shell(-14,8,18,12,1,True)
  for x in [7,20]:
   pipe('steel',3.8,12,(x,0,8));pipe('paint',4,1,(x,12,8),1)
   if level>0:
    axis('yellow',.25,8,(x,7,-2),'z',1);pipe('steel',.25,7,(x,0,-2),1)
  pipe('steel',2.3,23,(10,0,-10));pipe('paint',2.5,1,(10,23,-10),1)
  if level>0:
   for y in [5,11,17]:pipe('concrete',2.5,.35,(10,y,-10),1)
   for x in [6,14]:cube('yellow',(.25,23,.25),(x,11.5,-10),2)
   for y in range(2,22,2):cube('steel',(8,.18,.5),(10,y,-10),2)
   axis('yellow',.3,20,(-12,8,-7),'x',1);cube('paint',(7,4,5),(-15,2,-10),1)
 elif id=='glassWorks':
  shell(-7,5,30,24,1)
  cube('oxide',(12,6,12),(17,3,3));pipe('steel',1.6,21,(19,0,17))
  if level>0:
   cube('steel',(16,2,5),(11,7,3),1)
   for x in [-17,-3,11]:
    cube('steel',(8,1,5),(x,.6,-17),1)
    for k in [-1,1]:beam('steel',(x+k*3,1,-18),(x,7,-16),.35,1)
    glass((5,5,.18),(x,3.5,-16),1)
    for y in [2,4,6]:cube('yellow',(6,.16,.2),(x,y,-16.6),2)
   for z in [-3,2,7]:cube('steel',(.2,5,1),(22,2.5,z),2)
 elif id=='semiconductorFab':
  shell(0,4,36,24,1,True)
  cube('ceramic',(38,1.2,25),(0,9.6,4));cube('ceramic',(10,6,6),(0,3,-12))
  if level>0:
   glass((7,3,.12),(0,3.8,-15.1),1)
   for x in [-11,11]:
    for z in [-2,9]:
     cube('ceramic',(7,3,7),(x,11.6,z),1);cube('steel',(6,.3,6),(x,13.3,z),1)
     for stripe in range(-2,3):cube('paint',(5,.14,.3),(x,13.5,z+stripe),2)
   cube('steel',(30,1.4,2),(0,13.8,4),1)
   for x in [-10,0,10]:pipe('steel',.8,3,(x,14,4),2)
 elif id=='utilityVehicleWorks':
  shell(-3,4,42,30,2,True)
  for x in [-16,0,14]:cube('steel',(8,7,.4),(x,3.5,-11.3))
  # One static utility vehicle: no units, simulation, movement or ownership data.
  cube('paint',(9,2.3,4),(12,2.4,-20));cube('ceramic',(4,2.5,4),(10,4.8,-20))
  if level>0:
   glass((.12,1.7,3.5),(7.9,5,-20),1)
   for x in [9,15]:
    for z in [-22.65,-18]:axis('rubber',1.05,.65,(x,1.2,z),'z',1)
   cube('steel',(22,1,5),(-13,.7,-20),1)
   for x in [-21,-9]:robot(x,-20,1.1,1)
 elif id=='warehouse':
  shell(0,5,72,36,1,True)
  for x in [-27,-9,9,27]:
   cube('steel',(12,7,.5),(x,3.5,-13.4));cube('concrete',(13,1.2,7),(x,.7,-18))
   if level>0:
    for y in range(1,7):cube('paint',(11.5,.12,.12),(x,y,-13.8),2)
    for z in [-21,-17]:cube('yellow',(.4,2,.4),(x+6.5,1,z),1)
  if level>0:
   for x in [-28,26]:
    cube('paint',(7,3,5),(x,1.6,27.5),1)
    for y in [1,2.2]:cube('yellow',(7.2,.2,5.2),(x,y,27.5),2)
 elif id=='batteryWorks':
  shell(-5,5,36,30,1,True)
  cube('green',(38,1,1),(-5,8.3,-10.2));cube('paint',(8,6,7),(22,3,8))
  if level>0:
   for x in [-19,-5,9]:
    cube('steel',(8,.8,5),(x,.5,-19),1)
    for z in [-20,-18]:
     for dx in [-2,0,2]:pipe('green',.6,3,(x+dx,1,z),1)
    cube('yellow',(7.5,.2,5),(x,4.2,-19),2)
   for z in [0,14]:pipe('steel',2,10,(22,0,z),1)
   axis('paint',.35,13,(22,10,0),'z',2)
 else:raise ValueError('Unreviewed visual ID: '+id)
