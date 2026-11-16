"""Small adapter retaining the legacy SQLite query API over psycopg."""
import psycopg
from psycopg.rows import tuple_row

class HybridRow:
    def __init__(self, fields, values):
        self._fields=tuple(fields)
        self._values=tuple(values)
        self._data=dict(zip(fields,values))
    def __getitem__(self,key):
        return self._values[key] if isinstance(key,(int,slice)) else self._data[key]
    def __getattr__(self,key):
        try: return self._data[key]
        except KeyError: raise AttributeError(key)
    def __iter__(self):
        return iter(self._values)
    def keys(self): return self._data.keys()

class Cursor:
    def __init__(self,cur,query):
        self.cur=cur
        self.rowcount=cur.rowcount
        self.lastrowid=None
        if "INSERT INTO orders(" in query:
            row=cur.fetchone()
            self.lastrowid=row[0] if row else None
    def _convert(self,row):
        if row is None: return None
        names=[d.name for d in self.cur.description]
        return HybridRow(names,row)
    def fetchone(self): return self._convert(self.cur.fetchone())
    def fetchall(self): return [self._convert(row) for row in self.cur.fetchall()]
    def __iter__(self):
        for row in self.cur: yield self._convert(row)

class DB:
    def __init__(self,url):
        self.con=psycopg.connect(url,row_factory=tuple_row,connect_timeout=10)
    def execute(self,query,params=None):
        statement=query.replace("?","%s")
        if statement.startswith("INSERT OR IGNORE INTO "):
            statement=statement.replace("INSERT OR IGNORE INTO ","INSERT INTO ",1)+" ON CONFLICT DO NOTHING"
        if "INSERT INTO orders(" in statement and "RETURNING" not in statement:
            statement+=" RETURNING id"
        cur=self.con.execute(statement,params)
        return Cursor(cur,query)
    def executemany(self,query,params):
        with self.con.cursor() as cur: cur.executemany(query.replace("?","%s"),params)
    def __enter__(self): self.con.__enter__(); return self
    def __exit__(self,typ,val,tb): return self.con.__exit__(typ,val,tb)
