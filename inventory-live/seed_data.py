"""Conversation-verified stock snapshot (2026-11-15). Apply only once per database."""
import json

SNAPSHOT = json.loads("[[\"손톱깎이\",\"카이 119 L\",\"000KF1002\",49,5000,\"일본 카이 119 L\"],[\"손톱깎이\",\"카이 119 M\",\"000KF1001X1\",48,4000,\"일본 카이 119 M\"],[\"손톱깎이\",\"카이 119 S\",\"000KF1000X1\",54,3000,\"일본 카이 119 S\"],[\"손톱깎이\",\"카이 type001 L\",\"\",9,5000,\"\"],[\"손톱깎이\",\"카이 type001 M\",\"000KE0101\",12,4000,\"일본 카이 type001 M\"],[\"손톱깎이\",\"카이 type001 S\",\"000KE0120\",9,3000,\"\"],[\"손톱깎이\",\"카이 type002 M\",\"\",6,0,\"\"],[\"손톱깎이\",\"카이 type003 L\",\"\",13,0,\"\"],[\"손톱깎이\",\"카이 type003 M\",\"\",4,0,\"\"],[\"손톱깎이\",\"카이 type101 L\",\"\",4,0,\"\"],[\"손톱깎이\",\"카이 type101 S\",\"\",6,0,\"\"],[\"손톱깎이\",\"카이 HC-1829\",\"HC-1829\",11,0,\"\"],[\"손톱깎이\",\"카이 후지산 헬로키티\",\"KK-2526\",44,7000,\"\"],[\"손톱깎이\",\"카이 벚꽃 헬로키티 레드\",\"KK-2527\",39,7000,\"\"],[\"손톱깎이\",\"카이 헬로키티 블랙\",\"KK-2528\",6,7000,\"\"],[\"손톱깎이\",\"카이 헬로키티 미니\",\"\",43,8000,\"\"],[\"손톱깎이\",\"그린벨 G-1113 S\",\"\",242,0,\"\"],[\"손톱깎이\",\"그린벨 G-1114 L\",\"\",49,0,\"\"],[\"손톱깎이\",\"그린벨 G-1035\",\"\",59,0,\"\"],[\"손톱깎이\",\"그린벨 G-1305\",\"\",216,0,\"\"],[\"손톱깎이\",\"그린벨 G-1116\",\"\",72,0,\"\"],[\"손톱깎이\",\"그린벨 G-1115 S\",\"\",168,0,\"\"],[\"손톱깎이\",\"그린벨 GT-233\",\"\",36,0,\"\"],[\"손톱깎이\",\"그린벨 손톱줄\",\"G-1037\",38,5000,\"\"],[\"족집게\",\"그린벨 족집게\",\"PSG-100\",12,2000,\"\"],[\"족집게\",\"그린벨 족집게\",\"PSG-101\",12,2000,\"\"],[\"족집게\",\"그린벨 족집게\",\"GT-215\",12,2000,\"\"],[\"귀이개\",\"그린벨 귀이개\",\"G-2195\",36,3000,\"\"],[\"식품\",\"용각산 파우치형 100g\",\"\",118,1500,\"\"],[\"식품\",\"민티아 포도\",\"\",130,600,\"\"],[\"식품\",\"민티아 콜드스매쉬\",\"\",550,600,\"\"],[\"식품\",\"민티아 아쿠아스파크\",\"\",160,600,\"\"],[\"식품\",\"민티아 드라이하드\",\"\",143,600,\"\"],[\"식품\",\"민티아 칼피스\",\"\",220,600,\"\"],[\"식품\",\"민티아 와일드앤쿨\",\"\",23,600,\"\"],[\"식품\",\"민티아 카테킨\",\"\",8,600,\"\"]]")
CATEGORY_NAMES = ("손톱깎이", "족집게", "귀이개", "식품", "손수건")

def seed_initial_catalog(connection):
    # Existing databases retain orders, linked product IDs and custom products.
    # A migration marker prevents overwriting subsequent administrator edits.
    connection.execute("CREATE TABLE IF NOT EXISTS catalog_imports (version TEXT PRIMARY KEY, imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)")
    version = "conversation-2026-11-15-36-products"
    if connection.execute("SELECT 1 FROM catalog_imports WHERE version=?", (version,)).fetchone():
        return
    for order, category_name in enumerate(CATEGORY_NAMES, 1):
        connection.execute("INSERT OR IGNORE INTO categories(name,sort) VALUES (?,?)", (category_name, order))
        connection.execute("UPDATE categories SET sort=? WHERE name=?", (order,category_name))
    categories = dict(connection.execute("SELECT name,id FROM categories").fetchall())
    for category, name, sku, stock, price, legacy_name in SNAPSHOT:
        existing = None
        if legacy_name:
            existing = connection.execute("SELECT id FROM products WHERE name=?", (legacy_name,)).fetchone()
        if not existing and sku:
            existing = connection.execute("SELECT id FROM products WHERE sku=? AND category_id=?", (sku, categories[category])).fetchone()
        if not existing:
            existing = connection.execute("SELECT id FROM products WHERE name=? AND (sku=? OR sku='') AND category_id=?", (name,sku,categories[category])).fetchone()
        if existing:
            connection.execute("UPDATE products SET category_id=?, name=?, sku=?, stock=?, price=? WHERE id=?",
                               (categories[category], name, sku, stock, price, existing[0]))
        else:
            connection.execute("INSERT INTO products(category_id,name,sku,stock,price,boxes) VALUES(?,?,?,?,?,0)",
                               (categories[category],name,sku,stock,price))
    connection.execute("INSERT INTO catalog_imports(version) VALUES(?)", (version,))

def rename_requested_products(connection):
    """Once-only product name update, preserving SKU and stock internally."""
    version = "append-five-sku-to-names-2026-11-15"
    if connection.execute("SELECT 1 FROM catalog_imports WHERE version=?", (version,)).fetchone():
        return
    requested = {
        "HC-1829": "카이 HC-1829",
        "KK-2526": "카이 후지산 헬로키티 KK-2526",
        "KK-2527": "카이 벚꽃 헬로키티 레드 KK-2527",
        "GT-233": "그린벨 GT-233",
        "G-1037": "그린벨 손톱줄 G-1037",
    }
    for sku, new_name in requested.items():
        connection.execute("UPDATE products SET name=? WHERE sku=?", (new_name, sku))
    connection.execute("INSERT INTO catalog_imports(version) VALUES(?)", (version,))

def apply_nov15_stock_deductions(connection):
    """Subtract two explicitly requested quantities exactly once per database."""
    version = "deduct-yonggaksan-4-coldsmash-20-2026-11-15"
    if connection.execute("SELECT 1 FROM catalog_imports WHERE version=?", (version,)).fetchone():
        return
    for product_name, deduction in (("용각산 파우치형 100g", 4), ("민티아 콜드스매쉬", 20)):
        result = connection.execute(
            "UPDATE products SET stock=stock-? WHERE name=? AND stock>=?",
            (deduction, product_name, deduction),
        )
        if result.rowcount != 1:
            raise ValueError("재고 차감 실패: " + product_name)
    connection.execute("INSERT INTO catalog_imports(version) VALUES(?)", (version,))

def append_tweezer_earpick_models(connection):
    """Rename four items by stable SKU; do not modify product_url, stock, price, or IDs."""
    version = "append-tweezer-earpick-models-2026-11-16"
    if connection.execute("SELECT 1 FROM catalog_imports WHERE version=?", (version,)).fetchone():
        return
    changes = {
        "PSG-100": "그린벨 족집게 PSG-100",
        "PSG-101": "그린벨 족집게 PSG-101",
        "GT-215": "그린벨 족집게 GT-215",
        "G-2195": "그린벨 귀이개 G-2195",
    }
    for sku, name in changes.items():
        connection.execute("UPDATE products SET name=? WHERE sku=?", (name, sku))
    connection.execute("INSERT INTO catalog_imports(version) VALUES(?)", (version,))
