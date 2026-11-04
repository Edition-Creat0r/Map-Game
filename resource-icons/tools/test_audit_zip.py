import io, pathlib, tempfile, unittest, zipfile
from PIL import Image
from audit_zip import audit, EXPECTED
class AuditTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.path=pathlib.Path(self.temp.name)/'icons.zip'
        b=io.BytesIO();Image.new('RGBA',(64,64),(20,40,60,180)).save(b,format='PNG');self.png=b.getvalue()
    def tearDown(self): self.temp.cleanup()
    def write(self,change=None):
        data={n:self.png for n in EXPECTED}
        if change: change(data)
        with zipfile.ZipFile(self.path,'w',zipfile.ZIP_DEFLATED) as z:
            for n,b in data.items():z.writestr(n,b)
    def test_synthetic_valid_archive_never_imports(self):
        self.write();r=audit(self.path);self.assertEqual(r['count'],124);self.assertFalse(r['imported']);self.assertTrue(all(x['transparent'] for x in r['icons']));self.assertEqual(len(list(pathlib.Path(self.temp.name).iterdir())),1)
    def rejected(self,fn):
        self.write(fn)
        with self.assertRaises((ValueError,OSError,SyntaxError)):audit(self.path)
    def test_traversal(self):self.rejected(lambda d:d.update({'../icon.png':d.pop('64px/icon_1.png')}))
    def test_case_duplicate(self):self.rejected(lambda d:d.update({'64px/ICON_1.png':self.png}))
    def test_corrupt_png(self):self.rejected(lambda d:d.update({'64px/icon_1.png':self.png[:-8]}))
    def test_wrong_dimensions(self):
        b=io.BytesIO();Image.new('RGB',(1024,1024)).save(b,format='PNG');self.rejected(lambda d:d.update({'64px/icon_1.png':b.getvalue()}))
    def test_wrong_format(self):self.rejected(lambda d:d.update({'64px/icon_1.png':b'<svg/>'}))
    def test_missing(self):self.rejected(lambda d:d.pop('64px/icon_124.png'))
    def test_oversize(self):self.rejected(lambda d:d.update({'64px/icon_1.png':b'x'*300000}))
    def test_trailing_content(self):self.rejected(lambda d:d.update({'64px/icon_1.png':self.png+b'javascript:'}))
    def test_invisible(self):
        b=io.BytesIO();Image.new('RGBA',(64,64)).save(b,format='PNG');self.rejected(lambda d:d.update({'64px/icon_1.png':b.getvalue()}))
    def test_symlink(self):
        self.write()
        with zipfile.ZipFile(self.path,'a') as z:
            e=zipfile.ZipInfo('64px/');e.external_attr=(0o120777<<16);z.writestr(e,'/tmp')
        with self.assertRaises(ValueError):audit(self.path)
if __name__=='__main__':unittest.main()
