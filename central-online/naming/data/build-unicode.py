"""Generate public Unicode security data from installed ICU 76 (not moderation rules)."""
import ctypes as C,ctypes.util,json,pathlib,hashlib
root=pathlib.Path(__file__).parent
uc=C.CDLL(ctypes.util.find_library('icuuc')); i18n=C.CDLL(ctypes.util.find_library('icui18n'))
version='76'
getv=getattr(uc,'u_getUnicodeVersion_'+version);v=(C.c_uint8*4)();getv(v)
open_=getattr(i18n,'uspoof_open_'+version);open_.argtypes=[C.POINTER(C.c_int32)];open_.restype=C.c_void_p
err=C.c_int32(0);checker=open_(C.byref(err));assert err.value<=0
sk=getattr(i18n,'uspoof_getSkeletonUTF8_'+version);sk.argtypes=[C.c_void_p,C.c_uint32,C.c_char_p,C.c_int32,C.c_char_p,C.c_int32,C.POINTER(C.c_int32)];sk.restype=C.c_int32
fold=getattr(uc,'u_strFoldCase_'+version);fold.argtypes=[C.POINTER(C.c_uint16),C.c_int32,C.POINTER(C.c_uint16),C.c_int32,C.c_uint32,C.POINTER(C.c_int32)];fold.restype=C.c_int32
digit=getattr(uc,"u_charDigitValue_"+version);digit.argtypes=[C.c_int32];digit.restype=C.c_int32
char_type=getattr(uc,"u_charType_"+version);char_type.argtypes=[C.c_int32];char_type.restype=C.c_int8
assigned=[];start=None;last=None
skeleton={};casefold={};digits={};out=C.create_string_buffer(256);foldout=(C.c_uint16*32)()
for cp in range(0x110000):
 if 0xd800<=cp<=0xdfff:continue
 if char_type(cp)!=0:
  if start is None:start=cp
  elif last!=cp-1:assigned.append([start,last]);start=cp
  last=cp
 ch=chr(cp);dv=digit(cp)
 if dv>=0 and ch!=str(dv):digits[ch]=str(dv)
 b=ch.encode('utf8');err.value=0;n=sk(checker,0,b,len(b),out,256,C.byref(err));assert err.value<=0
 target=out.raw[:n].decode('utf8')
 if target!=ch:skeleton[ch]=target
 raw=ch.encode('utf-16-le');src=(C.c_uint16*(len(raw)//2)).from_buffer_copy(raw);err.value=0;n=fold(foldout,32,src,len(src),0,C.byref(err));assert err.value<=0
 target=C.string_at(foldout,n*2).decode('utf-16-le')
 if target!=ch:casefold[ch]=target
if start is not None:assigned.append([start,last])
getattr(i18n,'uspoof_close_'+version)(C.c_void_p(checker))
text='// Generated Unicode security/case-fold data. NOT a moderation word list.\nexport const unicodeVersion='+json.dumps('.'.join(map(str,list(v)[:3])))+';\nexport const confusables='+json.dumps(skeleton,ensure_ascii=True,separators=(',',':'))+';\nexport const folds='+json.dumps(casefold,ensure_ascii=True,separators=(',',':'))+';\nexport const digits='+json.dumps(digits,ensure_ascii=True,separators=(',',':'))+';\nexport const assignedRanges='+json.dumps(assigned,separators=(',',':'))+';\n'
(root/'unicode.mjs').write_text(text)
meta={'source':'Installed ICU 76, uspoof_getSkeletonUTF8 and u_strFoldCase; standard Unicode data only','unicodeVersion':'.'.join(map(str,list(v)[:3])),'confusableMappings':len(skeleton),'caseFoldMappings':len(casefold),'sha256':hashlib.sha256(text.encode()).hexdigest()}
(root/'provenance.json').write_text(json.dumps(meta,indent=2)+'\n')
(root/'ICU-UNICODE-LICENSE.txt').write_text(pathlib.Path('/usr/share/doc/libicu76/copyright').read_text())
print(meta)
