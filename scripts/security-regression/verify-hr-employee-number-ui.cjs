const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const {load}=require('./load-typescript.cjs');
const file='src/app/(shell)/hr/employees/new/page.tsx';
const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const functions={};
function visit(node){if(ts.isVariableDeclaration(node)&&['handleSubmit','handleSubmitNext'].includes(node.name.getText(source)))functions[node.name.getText(source)]=node.initializer.getText(source);ts.forEachChild(node,visit);}visit(source);
assert.equal(Object.keys(functions).length,2);
const js=ts.transpileModule(`const handleSubmit=${functions.handleSubmit};const handleSubmitNext=${functions.handleSubmitNext};exports.run=handleSubmitNext;`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const known=load('src/lib/hr/employee-number.ts').HR_EMPLOYEE_NUMBER_CONFLICT;
(async()=>{
 for(const [name,status,code,expectKnown]of[
  ['known employee conflict',409,known.code,true],
  ['unknown conflict code',409,'SYNTHETIC_PRIVATE_SERVER_DETAIL',false],
  ['malformed conflict code',409,{private:'SYNTHETIC_PRIVATE_SERVER_DETAIL'},false],
  ['server error with conflict code',500,known.code,false],
 ]){
  const exports={};const form={lastName:'Synthetic',firstName:'Browser',employeeNumber:'DUPLICATE'};const snapshot=JSON.stringify(form);let message='',requests=0,scrolled=0;
  vm.runInNewContext(js,{exports,departmentList:{status:'ready'},saving:false,submitted:false,form,photoFile:null,setFieldErrors:()=>{},setFormError:value=>{message=value;},setLimitNotice:()=>{},setSaving:()=>{},
   fetch:async()=>{requests++;return Response.json({code,error:'SYNTHETIC_PRIVATE_SERVER_DETAIL'},{status});},
   HR_EMPLOYEE_NUMBER_CONFLICT:known,hrErrorKind:()=> 'server',requestAnimationFrame:fn=>fn(),formErrorRef:{current:{scrollIntoView:()=>{scrolled++;}}},fid:name=>name,document:{getElementById:()=>null},
   toast:{error:()=>{throw Error('Server details must use the form error mapping');}},router:{push:()=>{throw Error('Failed save must retain the form');}},setSubmitted:()=>{throw Error('Failed save must not mark submitted');},setTimeout:()=>{throw Error('Failed save must not navigate');},console,
  },{filename:file});
  await exports.run({preventDefault(){}});assert.equal(requests,1);assert.equal(scrolled,1);assert.equal(message===known.error,expectKnown);assert.equal(message.includes('SYNTHETIC_PRIVATE_SERVER_DETAIL'),false);assert.equal(JSON.stringify(form),snapshot);console.log('PASS actual registration handlers '+name+': safe actionable message, no navigation, input retained');
 }
 console.log('4 actual registration handler UI cases passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
