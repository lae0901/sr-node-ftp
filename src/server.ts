import Client from './ftp/connection';
import
  {
    lockableResource_new, lockableResource_release,
    lockableResource_waitAndLock
  } from './common/sr_wait';
import { fstat, readFileSync } from 'fs';

// ------------------------------- iFtpConnection -------------------------------
export interface iFtpConnection
{
  c?: Client;
  fileSystem?: string;
  currentFolder: string;

  // use when fileSystem is library. then CWD to qsys.lib/currentLibrary.lib
  currentLibrary?: string;

  isReady?: boolean;
  namefmt?: string;  // site namefmt.  value is '0' or '1'.

  config?: iFtpConfig;
}

// ---------------------------------- iFtpConfig ----------------------------------
interface iFtpConfig
{
  host: string;
  user: string;
  password: string;
  port: number;
}

// ----------------------------- iDirectoryIdentifier -----------------------------
export interface iDirectoryIdentifier 
{
  folder?: string;
  subFolder?: string;
  library?: string;
}

let config: iFtpConfig = {
  host: "",
  user: "",
  password: "",
  port: 21
};

let global_conn: iFtpConnection = { config, currentFolder: '/home/srichter', fileSystem: 'ifs', namefmt: '1' };
const ftp_wait = lockableResource_new();

setTimeout(() =>
{
  config.port = 21;
}, 1);

console.log(`running server.ts`);

// load connection settings from command line.
const args = commandLine_getArguments( process.argv ) ;

// get settings from JSON file
if ( args.settingsFile )
{
  const text = readFileSync(`${args.settingsFile}`, 'utf-8');
  const settings = JSON.parse(text) ;
  config.host = settings.host ;
  config.user = settings.user ;
  config.password = settings.password ;
}
else
{
  config.host = args.host;
  config.user = args.user;
  config.password = args.password;
  config.port = args.port ? Number(args.port) : 21 ;
}
config.port = config.port || 21 ;

async_main( ) ;

// ---------------------------------- async_main ----------------------------------
async function async_main( )
{
  let errmsg = '';
  let dirPath = '';
  const fileSystem = 'ifs' ;

  await activeClient_insureConnected(global_conn);
  const { c } = global_conn;
  if (c)
  {
    ({ errmsg, dirPath } = await ftp_pwd(global_conn));

    {
      const cmd = `SITE namefmt 1`;
      const response = await ftp_raw( global_conn, cmd ) ;
      console.log(`${cmd}: ${response}`);
    }

    {
      const siteResponse = await ftp_site(global_conn, 'namefmt 1');
      console.log(`site: ${siteResponse}`);
    }

    {
      const cmd = `PWD`;
      const response = await ftp_raw(global_conn, cmd);
      console.log(`{cmd}: ${response}`);
    }

    {
      const cmd = `rcmd  couri7/UTL8180 OBJ(APLUSB1FCC/CUS*) OBJTYPE(*ALL) TOCSV('/tmp/utl8180.csv')`;
      const response = await ftp_raw(global_conn, cmd);
      console.log(`{cmd}: ${response}`);
    }
  }
  else
  {
    errmsg = 'not connected';
  }

  console.log(`errmsg:${errmsg} dirPath:${dirPath}`);
  return { errmsg, dirPath };
}

// --------------------------- commandLine_getArguments ---------------------------
// return command line arguments as object where each property is argument key and
// its following value.  -user xxxx -addr 173.33
function commandLine_getArguments( argv: string[] ) : {[key:string] : string}
{
  let key = '' ;
  let vlu = '' ;
  const args: {[key:string] : string } = {} ;
  for( const arg of argv )
  {
    // key names start with "-"
    const match = arg.match(/-(\w+)/);  // remove leading - from key.
    if (match)
      key = match[1];

    // have a key. Store arg as property value.
    else if ( key )
    {
      vlu = arg;
      args[key] = vlu;
      key = '';
    }
  }
  return args;
}

// ----------------------------------- ftp_pwd -----------------------------------
export function ftp_pwd(conn: iFtpConnection):
  Promise<{ dirPath: string, fileSystem: string, errmsg: string }>
{
  const promise = new Promise<{ dirPath: string, fileSystem: string, errmsg: string }>((resolve, reject) =>
  {
    if (!conn.c)
      throw `not connected`;
    let errmsg = '';
    let fileSystem = '';
    conn.c.pwd((err, dirPath) =>
    {
      if (err)
        errmsg = err.message;

      // calc the fileSystem of the dirPath.
      // fileSystem = ftpPath_fileSystem(dirPath);
      fileSystem = 'ifs' ;

      resolve({ dirPath, fileSystem, errmsg });
    });
  });
  return promise;
}

// ----------------------------------- ftp_quote -----------------------------------
// run site command on the server.
// example: site namefmt 1
export function ftp_quote(conn: iFtpConnection, cmd: string): Promise<string>
{
  const promise = new Promise<string>((resolve, reject) =>
  {
    const { c } = conn;
    if (!c)
      throw 'not connected';
    c.quote(cmd, function (err, respText, respCode)
    {
      if (err) throw err;
      resolve(respText);
    });
  });
  return promise;
}

// ----------------------------------- ftp_raw -----------------------------------
// run site command on the server.
// example: site namefmt 1
export function ftp_raw(conn: iFtpConnection, cmd: string): Promise<string>
{
  const promise = new Promise<string>((resolve, reject) =>
  {
    const { c } = conn;
    if (!c)
      throw 'not connected';
    c.raw(cmd, function (err, respText, respCode)
    {
      if (err) throw err;
      resolve(respText);
    });
  });
  return promise;
}

// ----------------------------------- ftp_site -----------------------------------
// run site command on the server.
// example: site namefmt 1
export function ftp_site(conn: iFtpConnection, cmd: string): Promise<string>
{
  const promise = new Promise<string>((resolve, reject) =>
  {
    const { c } = conn;
    if (!c)
      throw 'not connected';
    c.site(cmd, function (err, respText, respCode)
    {
      if (err) throw err;
      resolve(respText);
    });
  });
  return promise;
}

// ------------------------- activeClient_insureConnected -------------------------
function activeClient_insureConnected(conn: iFtpConnection)
  : Promise<null>
{
  const promise = new Promise<null>(async (resolve, reject) =>
  {
    // client is connected.  run the pwd command to check that connection has dropped.
    if (conn.c && conn.isReady)
    {
      const { errmsg, dirPath } = await ftp_pwd(conn);
      if (errmsg)
      {
        conn.c = undefined;
        conn.isReady = false;
      }
    }

    if (conn.c)
    {
      resolve(null);
    }

    // connect the client.
    if (!conn.c)
    {
      conn.c = new Client();
      const c = conn.c;

      c.on("greeting", function ()
      {
        console.log("greeting");
      });
      c.on("close", function ()
      {
        console.log("close");
      });
      c.on("end", function ()
      {
        console.log("end");
      });

      c.on("ready", async function ()
      {
        conn.isReady = true;
        console.log('ready');

        conn.namefmt = conn.namefmt || '1';
        const xx = await ftp_site(conn, `namefmt ${conn.namefmt}`);

        // // set the current IFS folder or current library.
        // if (conn.currentFolder || conn.currentLibrary)
        // {
        //   await ftp_cwd(conn);
        // }

        resolve(null);
      });

      c.connect(conn.config);
    }
  });
  return promise;
}
