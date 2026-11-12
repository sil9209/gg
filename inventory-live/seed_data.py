"""Initial stock snapshot from inventory conversation. Runs only on empty catalog."""
from datetime import datetime
def seed_initial_catalog(connection):
    if connection.execute("SELECT COUNT(*) FROM products").fetchone()[0]:
        return
    c=connection.execute("SELECT id FROM categories WHERE name='손톱깎이'").fetchone()
    if not c:
        connection.execute("INSERT INTO categories(name,sort) VALUES('손톱깎이',3)")
        c=connection.execute("SELECT id FROM categories WHERE name='손톱깎이'").fetchone()
    cat=c[0]
    rows=[
      ("일본 카이 119 S","000KF1000X1",9,54,3000,""),
      ("일본 카이 119 M","000KF1001X1",8,48,4000,""),
      ("일본 카이 119 L","000KF1002",8,48,5000,""),
      ("일본 카이 type001 M","000KE0101",2,10,0,"1박스 6개입 + 1박스 4개입"),
      ("그린벨 G-1113 S","",15,182,0,"12개입 14박스, 11개입 1박스, 낱개 4개 추가 / 판매 1개"),
      ("그린벨 G-1114 L","",4,48,0,"12개입"),
      ("그린벨 G-1035","",1,12,0,"12개입"),
      ("그린벨 G-1305","",21,126,0,"6개입"),
      ("그린벨 G-1116","",12,72,0,"6개입"),
      ("그린벨 G-1115 S","",4,48,0,"12개입"),
      ("그린벨 GT-233","",3,36,0,"12개입"),
    ]
    connection.executemany("INSERT INTO products(category_id,name,sku,boxes,stock,price,notes) VALUES(?,?,?,?,?,?,?)",[(cat,n,sku,b,s,p,note) for n,sku,b,s,p,note in rows])
