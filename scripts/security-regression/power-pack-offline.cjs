const fs=require('node:fs'),net=require('node:net'),http=require('node:http'),path=require('node:path'),os=require('node:os');
const owned=new Set(),parentPipe=path.join(os.tmpdir(),'tsx-'+process.geteuid(),process.ppid+'.pipe');
function deny(kind){fs.appendFileSync(process.env.DOYA_HTTP_DENIED_LOG,JSON.stringify({kind,pid:process.pid})+'\n');throw Error('EXTERNAL_NETWORK_DISABLED')}
function allowed(value){if(typeof value==='string'||value instanceof URL){try{value=new URL(value);return value.protocol==='data:'||(value.hostname==='127.0.0.1'&&value.protocol==='http:'&&owned.has(String(value.port)))}catch{return false}}return value&&(value.host==='127.0.0.1'||value.hostname==='127.0.0.1')&&owned.has(String(value.port))}
// Keep this process's bound loopback ports until exit: undici may retry a
// previously owned socket while its server is closing. Native ECONNREFUSED
// must settle that retry instead of a synchronous guard exception.
const listen=net.Server.prototype.listen;net.Server.prototype.listen=function(...args){this.once('listening',()=>{const a=this.address();if(a&&typeof a==='object'&&a.address==='127.0.0.1')owned.add(String(a.port))});return listen.apply(this,args)};
const connect=net.Socket.prototype.connect;net.Socket.prototype.connect=function(...args){let value=args[0];if(Array.isArray(value))value=value[0];const ipc=value===parentPipe||(value&&value.path===parentPipe&&value.host==null&&value.port==null);if(!allowed(value)&&!ipc)return deny('socket.connect');return connect.apply(this,args)};
const request=http.request;http.request=function(options,...args){if(!allowed(options))return deny('http.request');return request.call(this,options,...args)};
http.get=()=>deny('http.get');for(const name of ['request','get'])require('node:https')[name]=()=>deny('https.'+name);require('node:tls').connect=()=>deny('tls.connect');const fetch=globalThis.fetch;globalThis.fetch=(input,...args)=>{if(!allowed(input instanceof Request?input.url:input))return deny('fetch');return fetch(input,...args)};
