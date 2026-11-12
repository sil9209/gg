import os, sqlite3, hmac, secrets, json, re
from functools import wraps
from urllib.parse import urlparse
from flask import Flask, request, session, redirect, url_for, render_template_string, abort, flash, jsonify

app=Flask(__name__)
app.secret_key=os.environ["SECRET_KEY"]
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax", SESSION_COOKIE_SECURE=True)
DB=os.environ.get("DATABASE_PATH","/var/data/inventory.sqlite3")
os.makedirs(os.path.dirname(DB),exist_ok=True)
def db():
 c=sqlite3.connect(DB,timeout=30);c.row_factory=sqlite3.Row;c.execute("PRAGMA foreign_keys=ON");c.execute("PRAGMA busy_timeout=30000");return c
with db() as c:
 c.execute("PRAGMA journal_mode=WAL")
 c.executescript("""
 CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE,sort INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY,category_id INTEGER NOT NULL REFERENCES categories(id),name TEXT NOT NULL,sku TEXT NOT NULL DEFAULT '',price INTEGER NOT NULL DEFAULT 0,stock INTEGER NOT NULL DEFAULT 0,boxes INTEGER NOT NULL DEFAULT 0,notes TEXT NOT NULL DEFAULT '',product_url TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,phone TEXT NOT NULL,fulfillment TEXT NOT NULL,subtotal INTEGER NOT NULL,shipping INTEGER NOT NULL,total INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'received',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY,order_id INTEGER NOT NULL REFERENCES orders(id),product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,name TEXT NOT NULL,qty INTEGER NOT NULL,price INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS movements(id INTEGER PRIMARY KEY,product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,kind TEXT,qty INTEGER,detail TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 """)
 if not c.execute("SELECT 1 FROM categories LIMIT 1").fetchone():
  c.executemany("INSERT INTO categories(name,sort) VALUES(?,?)",[("식품",1),("손수건",2),("손톱깎이",3)])
def csrf():
 if "csrf" not in session:session["csrf"]=secrets.token_urlsafe(24)
 return session["csrf"]
@app.before_request
def check_csrf():
 if request.method=="POST" and not hmac.compare_digest(str(request.form.get("_csrf","")),csrf()):abort(400)
def login_required(f):
 @wraps(f)
 def w(*a,**k):
  if not session.get("admin"):return redirect("/login")
  return f(*a,**k)
 return w
def cats():
 with db() as c:return c.execute("SELECT * FROM categories ORDER BY sort,id").fetchall()
def products():
 with db() as c:return c.execute("SELECT p.*,c.name category FROM products p JOIN categories c ON c.id=p.category_id ORDER BY c.sort,p.id").fetchall()
def money(v):return f"{int(v):,}원"
app.jinja_env.globals.update(money=money,csrf=csrf)
BASE="""<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>재고·주문 관리</title><style>
:root{font-family:system-ui,-apple-system,'Malgun Gothic',sans-serif;color:#172434;background:#f6f8fb}*{box-sizing:border-box}body{margin:0}header{background:#fff;border-bottom:1px solid #e4e9f0;padding:17px max(20px,calc((100vw - 1100px)/2));display:flex;justify-content:space-between;align-items:center;gap:12px}header strong{font-size:19px}main{max-width:1100px;padding:24px 16px 110px;margin:auto}a{color:#176bd1;text-decoration:none}button,.btn{cursor:pointer;background:#176bd1;color:white;border:0;border-radius:9px;padding:11px 16px;font:inherit;display:inline-block}button:disabled{opacity:.4;cursor:not-allowed}.light{background:#edf2f8;color:#1a3a62}.danger{background:#fff0f0;color:#b52b2b}.tabs{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.tabs a{border:1px solid #dfe5ed;border-radius:30px;padding:10px 17px;background:#fff;color:#324763}.tabs a.active{background:#176bd1;color:#fff}.panel{background:#fff;border:1px solid #e3e9ef;border-radius:15px;padding:20px;margin:16px 0}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.stat{background:#eff4fb;padding:18px;border-radius:13px}.stat b{display:block;font-size:24px;margin-top:8px}.muted{color:#66788c;font-size:13px}table{width:100%;border-collapse:collapse;background:#fff}th,td{padding:12px 9px;text-align:left;border-bottom:1px solid #ebeff4;font-size:14px}th{color:#65758a}input,select{font:inherit;padding:11px;border:1px solid #ccd5df;border-radius:8px;max-width:100%}input[type=number]{width:100px}label{display:block;font-size:13px;color:#57687a;margin:11px 0}label input,label select{display:block;margin-top:5px;width:100%}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.flex{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.scroll{overflow-x:auto}.cart{position:fixed;right:18px;bottom:18px;border:0;border-radius:30px;padding:16px 24px;box-shadow:0 5px 22px #0b224033;z-index:5}.drawer{position:fixed;right:18px;bottom:80px;width:min(370px,calc(100vw - 36px));max-height:65vh;overflow:auto;padding:22px;border-radius:16px;background:white;box-shadow:0 9px 35px #0b224044;z-index:5;display:none}.drawer.open{display:block}.row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #eff1f5}.flash{background:#fff1d8;padding:11px;border-radius:8px;margin:9px 0}.narrow{max-width:610px;margin:0 auto}small{color:#68788b} .pill{background:#e8f2ff;padding:5px 9px;border-radius:15px;color:#176bd1} @media(max-width:680px){.stats{grid-template-columns:repeat(3,1fr)}.stat{padding:10px}.stat b{font-size:18px}.grid{grid-template-columns:1fr}th,td{padding:9px 5px;font-size:12px}}
</style></head><body><header><strong><a href="/" style="color:inherit">📦 재고·주문 관리</a></strong><nav><a href="/">상품 보기</a> {% if session.get('admin') %} · <a href="/admin">관리자</a> · <a href="/admin/orders">주문관리</a>{% else %} · <a href="/login">관리자 로그인</a>{% endif %}</nav></header><main>{% for f in get_flashed_messages() %}<p class="flash">{{f}}</p>{% endfor %}<!--CONTENT--></main></body></html>"""
def page(html,**ctx):return render_template_string(BASE.replace("<!--CONTENT-->",html),**ctx)
@app.get("/")
def index():
 cat=request.args.get("cat","all");q=request.args.get("q","").lower().strip()
 rows=[dict(p) for p in products() if (cat=="all" or str(p["category_id"])==cat) and (not q or q in p["name"].lower())]
 return page("""<h1>상품 재고 현황</h1><p class="muted">원하는 카테고리를 선택하고 수량을 장바구니에 담아 신청하세요.</p><div class="tabs"><a class="{{'active' if chosen=='all' else ''}}" href="/">전체</a>{% for c in categories %}<a class="{{'active' if chosen==c.id|string else ''}}" href="/?cat={{c.id}}">{{c.name}}</a>{% endfor %}</div><div class="stats"><div class="stat">상품 종류<b>{{rows|length}}종</b></div><div class="stat">현재 재고<b>{{rows|sum(attribute='stock')}}개</b></div><div class="stat">박스 수<b>{{rows|sum(attribute='boxes')}}박스</b></div></div><form class="panel flex" method="get"><input name="q" placeholder="상품명" value="{{q}}"><input type="hidden" name="cat" value="{{chosen}}"><button>검색</button></form><div class="panel scroll"><table><thead><tr><th>상품명</th><th>모델명</th><th>재고</th><th>가격</th><th>담기</th></tr></thead><tbody>{% for p in rows %}<tr><td>{% if p.product_url %}<a href="{{p.product_url}}" target="_blank" rel="noopener noreferrer">{{p.name}} ↗</a>{% else %}{{p.name}}{% endif %}<br><small>{{p.notes}}</small></td><td>{{p.sku}}</td><td>{{p.stock}}개</td><td>{{money(p.price)}}</td><td>{% if p.stock>0 and p.price>0 %}<div class="flex"><input type="number" min="1" max="{{p.stock}}" value="1" id="qty-{{p.id}}"><button class="light" onclick="addItem({{p.id}},{{p.name|tojson}},{{p.price}},{{p.stock}})" type="button">담기</button></div>{% else %}<small>신청불가</small>{% endif %}</td></tr>{% else %}<tr><td colspan="5">등록된 상품이 없습니다.</td></tr>{% endfor %}</tbody></table></div><div class="drawer" id="drawer"><h3>장바구니</h3><div id="cartlines"></div><p><b id="carttotal"></b></p><a class="btn" href="/checkout">신청하러 가기</a> <button class="light" onclick="toggleCart()">닫기</button></div><button class="cart" onclick="toggleCart()" id="cartbutton">🛒 장바구니 (0)</button><script>
const KEY='inventory_cart_v1';let cart=JSON.parse(localStorage.getItem(KEY)||'{}');
function save(){localStorage.setItem(KEY,JSON.stringify(cart));render()}
function addItem(id,name,price,stock){let q=Number(document.getElementById('qty-'+id).value);if(!Number.isInteger(q)||q<1||q>stock)return alert('재고 내에서 수량을 입력하세요');cart[id]=cart[id]||{id,name,price,stock,qty:0};if(cart[id].qty+q>stock)return alert('재고를 초과합니다');cart[id].qty+=q;save();document.getElementById('drawer').classList.add('open')}
function removeItem(id){delete cart[id];save()}
function toggleCart(){document.getElementById('drawer').classList.toggle('open');render()}
function render(){let arr=Object.values(cart);document.getElementById('cartbutton').innerText='🛒 장바구니 ('+arr.reduce((a,x)=>a+x.qty,0)+')';document.getElementById('cartlines').innerHTML=arr.map(x=>'<div class="row"><span>'+escapeHtml(x.name)+' × '+x.qty+'</span><span>'+(x.qty*x.price).toLocaleString()+'원 <button class="danger" onclick="removeItem('+x.id+')">삭제</button></span></div>').join('')||'<p>담긴 상품이 없습니다.</p>';document.getElementById('carttotal').innerText='상품 합계 '+arr.reduce((a,x)=>a+x.qty*x.price,0).toLocaleString()+'원'}
function escapeHtml(t){let el=document.createElement('span');el.textContent=t;return el.innerHTML}render()
</script>""",categories=cats(),rows=rows,chosen=cat,q=q)
@app.route("/login",methods=["GET","POST"])
def login():
 if request.method=="POST":
  pwd=os.environ.get("ADMIN_PASSWORD","")
  if pwd and hmac.compare_digest(request.form.get("password",""),pwd):
   session.clear();session["admin"]=True;flash("관리자 로그인 완료");return redirect("/admin")
  flash("비밀번호가 맞지 않습니다.")
 return page("""<div class="panel narrow"><h2>관리자 로그인</h2><form method="post"><input type="hidden" name="_csrf" value="{{csrf()}}"><label>비밀번호<input type="password" name="password" required autocomplete="current-password"></label><button>로그인</button></form></div>""")
@app.post("/logout")
@login_required
def logout():session.clear();return redirect("/")
@app.get("/admin")
@login_required
def admin():
 return page("""<h1>상품 및 카테고리 관리</h1><div class="flex"><a href="/admin/orders" class="btn">주문 접수 확인</a><form action="/logout" method="post"><input type="hidden" name="_csrf" value="{{csrf()}}"><button class="light">로그아웃</button></form></div><div class="panel"><h2>카테고리 추가</h2><form action="/admin/category" method="post" class="flex"><input type="hidden" name="_csrf" value="{{csrf()}}"><input name="name" placeholder="카테고리명" required maxlength="40"><button>추가</button></form><div class="tabs">{% for c in categories %}<span class="pill">{{c.name}}</span>{% endfor %}</div></div><div class="panel"><h2>상품 등록</h2><form action="/admin/product" method="post"><input type="hidden" name="_csrf" value="{{csrf()}}"><div class="grid"><label>카테고리<select name="category_id">{% for c in categories %}<option value="{{c.id}}">{{c.name}}</option>{% endfor %}</select></label><label>상품명<input required name="name"></label><label>모델명<input name="sku"></label><label>개당 가격(원)<input required name="price" type="number" min="0"></label><label>현재 재고(개)<input required name="stock" type="number" min="0"></label><label>박스 수<input required name="boxes" type="number" min="0" value="0"></label><label>제품명 링크 URL<input name="product_url" type="url" placeholder="https://..."></label><label>비고<input name="notes"></label></div><button>상품 등록</button></form></div><div class="panel scroll"><h2>등록된 상품</h2><table><tr><th>제품명</th><th>카테고리</th><th>재고</th><th>가격</th><th>관리</th></tr>{% for p in products %}<tr><td>{{p.name}}</td><td>{{p.category}}</td><td>{{p.stock}}</td><td>{{money(p.price)}}</td><td><a class="btn light" href="/admin/product/{{p.id}}">수정 / 재고변경</a></td></tr>{% else %}<tr><td colspan="5">아직 상품이 없습니다.</td></tr>{% endfor %}</table></div>""",categories=cats(),products=products())
@app.post("/admin/category")
@login_required
def category_add():
 name=request.form.get("name","").strip()[:40]
 if name:
  try:
   with db() as c:c.execute("INSERT INTO categories(name,sort) VALUES(?,(SELECT COALESCE(MAX(sort),0)+1 FROM categories))",(name,))
  except sqlite3.IntegrityError:flash("이미 있는 카테고리입니다.")
 return redirect("/admin")
def num(v,minimum=0):
 n=int(v)
 if n<minimum:raise ValueError("숫자 범위 오류")
 return n
def valid_url(v):
 v=v.strip()
 if not v:return ""
 u=urlparse(v)
 if u.scheme not in ("http","https") or not u.netloc or u.username or u.password:raise ValueError("링크 형식 오류")
 return v[:1000]
@app.post("/admin/product")
@login_required
def add_product():
 try:
  v=(num(request.form["category_id"],1),request.form["name"].strip()[:120],request.form.get("sku","").strip()[:80],num(request.form["price"]),num(request.form["stock"]),num(request.form["boxes"]),request.form.get("notes","").strip()[:300],valid_url(request.form.get("product_url","")))
  if not v[1]:raise ValueError("상품명이 필요합니다.")
  with db() as c:c.execute("INSERT INTO products(category_id,name,sku,price,stock,boxes,notes,product_url) VALUES(?,?,?,?,?,?,?,?)",v)
  flash("상품이 등록되었습니다.")
 except (ValueError,KeyError,sqlite3.IntegrityError):flash("등록 정보를 확인해주세요.")
 return redirect("/admin")
@app.route("/admin/product/<int:pid>",methods=["GET","POST"])
@login_required
def edit_product(pid):
 with db() as c:p=c.execute("SELECT * FROM products WHERE id=?",(pid,)).fetchone()
 if not p:abort(404)
 if request.method=="POST":
  try:
   v=(num(request.form["category_id"],1),request.form["name"].strip()[:120],request.form.get("sku","").strip()[:80],num(request.form["price"]),num(request.form["stock"]),num(request.form["boxes"]),request.form.get("notes","").strip()[:300],valid_url(request.form.get("product_url","")),pid)
   if not v[1]:raise ValueError()
   with db() as c:
    c.execute("BEGIN IMMEDIATE")
    old=c.execute("SELECT stock FROM products WHERE id=?",(pid,)).fetchone()[0]
    c.execute("UPDATE products SET category_id=?,name=?,sku=?,price=?,stock=?,boxes=?,notes=?,product_url=? WHERE id=?",v)
    if old!=v[4]:c.execute("INSERT INTO movements(product_id,kind,qty,detail) VALUES(?,?,?,?)",(pid,"manual",v[4]-old,"관리자 재고 수정"))
   flash("수정 완료");return redirect("/admin")
  except (ValueError,KeyError):flash("입력 내용을 확인하세요.")
 return page("""<div class="narrow"><h1>상품 수정 · 재고 조정</h1><form class="panel" method="post"><input type="hidden" name="_csrf" value="{{csrf()}}"><label>카테고리<select name="category_id">{% for c in categories %}<option value="{{c.id}}" {{'selected' if c.id==p.category_id else ''}}>{{c.name}}</option>{% endfor %}</select></label><label>상품명<input name="name" value="{{p.name}}" required></label><label>모델명<input name="sku" value="{{p.sku}}"></label><label>가격(원)<input name="price" type="number" min="0" value="{{p.price}}"></label><label>현재 재고<input name="stock" type="number" min="0" value="{{p.stock}}"></label><label>박스 수<input name="boxes" type="number" min="0" value="{{p.boxes}}"></label><label>제품 링크<input name="product_url" value="{{p.product_url}}" type="url"></label><label>비고<input name="notes" value="{{p.notes}}"></label><button>저장하기</button> <a href="/admin">취소</a></form></div>""",p=p,categories=cats())
@app.get("/checkout")
def checkout():
 return page("""<div class="narrow"><h1>주문 신청</h1><div class="panel" id="lines"></div><form class="panel" method="post" action="/orders" onsubmit="return submitCart()"><input type="hidden" name="_csrf" value="{{csrf()}}"><input type="hidden" name="cart" id="cartfield"><label>이름<input name="name" required maxlength="60"></label><label>전화번호<input name="phone" type="tel" required minlength="8" maxlength="30" placeholder="010-0000-0000"></label><label>수령방법<select name="fulfillment" id="fulfillment" onchange="recalc()"><option value="pickup">민경직접 (무료)</option><option value="delivery">택배 (+3,000원)</option></select></label><p class="muted">이름·전화번호는 주문 접수 및 연락을 위해 관리자에게 제공됩니다.</p><label><input style="width:auto;display:inline" type="checkbox" required> 개인정보 수집 및 이용에 동의합니다.</label><div class="row"><b>상품 금액</b><b id="subtotal"></b></div><div class="row"><b>배송비</b><b id="fee"></b></div><div class="row"><b>최종 신청 금액</b><h2 id="total"></h2></div><p class="muted">신청 즉시 재고가 차감됩니다. 별도의 온라인 결제는 진행되지 않습니다.</p><button style="width:100%" id="submit">신청하기</button></form></div><script>
const cart=Object.values(JSON.parse(localStorage.getItem('inventory_cart_v1')||'{}'));let sum=cart.reduce((a,x)=>a+x.price*x.qty,0);
function safe(t){let e=document.createElement('span');e.textContent=t;return e.innerHTML}
document.getElementById('lines').innerHTML=cart.map(x=>'<div class="row"><span>'+safe(x.name)+' × '+x.qty+'</span><b>'+(x.qty*x.price).toLocaleString()+'원</b></div>').join('')||'장바구니가 비어 있습니다.';
document.getElementById('submit').disabled=!cart.length;
function recalc(){let fee=document.getElementById('fulfillment').value==='delivery'?3000:0;document.getElementById('subtotal').innerText=sum.toLocaleString()+'원';document.getElementById('fee').innerText=fee.toLocaleString()+'원';document.getElementById('total').innerText=(sum+fee).toLocaleString()+'원'}
function submitCart(){if(!cart.length)return false;document.getElementById('cartfield').value=JSON.stringify(cart.map(x=>({id:x.id,qty:x.qty})));return true}recalc()
</script>""")
@app.post("/orders")
def order_submit():
 name=request.form.get("name","").strip()[:60];phone=request.form.get("phone","").strip()[:30];fulfillment=request.form.get("fulfillment")
 if not name or not re.fullmatch(r"[0-9+\-() ]{8,30}",phone) or fulfillment not in ("pickup","delivery"):flash("신청 정보를 확인하세요.");return redirect("/checkout")
 try:
  incoming=json.loads(request.form.get("cart","[]"))
  if not isinstance(incoming,list) or not 1<=len(incoming)<=100:raise ValueError("장바구니를 확인하세요.")
  selected={}
  for line in incoming:
   pid=num(line["id"],1);q=num(line["qty"],1)
   selected[pid]=selected.get(pid,0)+q
   if selected[pid]>100000:raise ValueError("수량이 너무 많습니다.")
  with db() as c:
   c.execute("BEGIN IMMEDIATE")
   items=[];subtotal=0
   for pid,qty in selected.items():
    p=c.execute("SELECT * FROM products WHERE id=?",(pid,)).fetchone()
    if not p or p["stock"]<qty or p["price"]<=0:raise ValueError("상품 재고 또는 가격을 확인하세요.")
    items.append((pid,p["name"],qty,p["price"]));subtotal+=qty*p["price"]
   shipping=3000 if fulfillment=="delivery" else 0
   oid=c.execute("INSERT INTO orders(name,phone,fulfillment,subtotal,shipping,total) VALUES(?,?,?,?,?,?)",(name,phone,fulfillment,subtotal,shipping,subtotal+shipping)).lastrowid
   for pid,n,q,price in items:
    c.execute("UPDATE products SET stock=stock-? WHERE id=? AND stock>=?",(q,pid,q))
    c.execute("INSERT INTO order_items(order_id,product_id,name,qty,price) VALUES(?,?,?,?,?)",(oid,pid,n,q,price))
    c.execute("INSERT INTO movements(product_id,kind,qty,detail) VALUES(?,?,?,?)",(pid,"order",-q,f"주문 #{oid}"))
  session["last_order"]=oid;return redirect(f"/complete/{oid}")
 except (ValueError,KeyError,TypeError,json.JSONDecodeError) as e:flash(str(e) or "주문 오류");return redirect("/checkout")
@app.get("/complete/<int:oid>")
def complete(oid):
 if session.get("last_order")!=oid:return redirect("/")
 return page("""<div class="panel narrow"><h1>✅ 주문 신청 완료</h1><p>접수번호 <b>#{{oid}}</b></p><p>관리자에게 주문이 접수되어 재고가 차감되었습니다.</p><a class="btn" href="/">상품 목록</a></div><script>localStorage.removeItem('inventory_cart_v1')</script>""",oid=oid)
@app.get("/admin/orders")
@login_required
def admin_orders():
 with db() as c:
  orders=c.execute("SELECT * FROM orders ORDER BY id DESC LIMIT 500").fetchall()
  items=c.execute("SELECT * FROM order_items ORDER BY id DESC").fetchall()
 grouped={}
 for x in items:grouped.setdefault(x["order_id"],[]).append(x)
 return page("""<h1>주문 접수 관리</h1><p class="muted">새 주문이 들어오면 이 화면에서 확인할 수 있습니다.</p>{% for o in orders %}<section class="panel"><div class="flex"><b>주문 #{{o.id}}</b><span class="pill">{{'접수' if o.status=='received' else '취소'}}</span><small>{{o.created_at}} UTC</small></div><p><b>{{o.name}}</b> · <a href="tel:{{o.phone}}">{{o.phone}}</a> · {{'택배' if o.fulfillment=='delivery' else '민경직접'}}</p>{% for i in grouped.get(o.id,[]) %}<div class="row"><span>{{i.name}} × {{i.qty}}</span><span>{{money(i.qty*i.price)}}</span></div>{% endfor %}<p>상품 {{money(o.subtotal)}} + 배송비 {{money(o.shipping)}} = <b>{{money(o.total)}}</b></p>{% if o.status=='received' %}<form action="/admin/orders/{{o.id}}/cancel" method="post" onsubmit="return confirm('주문 취소 후 재고를 복원하시겠습니까?')"><input name="_csrf" type="hidden" value="{{csrf()}}"><button class="danger">주문 취소 · 재고 복구</button></form>{% endif %}</section>{% else %}<div class="panel">접수된 주문이 없습니다.</div>{% endfor %}""",orders=orders,grouped=grouped)
@app.post("/admin/orders/<int:oid>/cancel")
@login_required
def cancel(oid):
 with db() as c:
  c.execute("BEGIN IMMEDIATE")
  o=c.execute("SELECT status FROM orders WHERE id=?",(oid,)).fetchone()
  if not o:abort(404)
  if o["status"]=="received":
   for it in c.execute("SELECT product_id,qty FROM order_items WHERE order_id=?",(oid,)).fetchall():
    if it["product_id"] is not None:
     c.execute("UPDATE products SET stock=stock+? WHERE id=?",(it["qty"],it["product_id"]))
     c.execute("INSERT INTO movements(product_id,kind,qty,detail) VALUES(?,?,?,?)",(it["product_id"],"cancel",it["qty"],f"주문 #{oid} 취소"))
   c.execute("UPDATE orders SET status='cancelled' WHERE id=?",(oid,))
 return redirect("/admin/orders")
@app.get("/health")
def health():return jsonify(ok=True)
from seed_data import seed_initial_catalog
with db() as seed_connection:
 seed_initial_catalog(seed_connection)

if __name__=="__main__":app.run(host="0.0.0.0",port=int(os.environ.get("PORT","5000")))
