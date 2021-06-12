import Client from './ftp/connection';
import
  {
    lockableResource_new, lockableResource_release,
    lockableResource_waitAndLock
  } from './common/sr_wait';


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
  host: "173.54.20.170",
  user: "srichter",
  password: "denville",
  port: 21
};

let global_conn: iFtpConnection = { config, currentFolder: '/home/srichter', fileSystem: 'ifs', namefmt: '1' };
const ftp_wait = lockableResource_new();

setTimeout(() =>
{
  config.port = 21;
}, 1);

console.log(`running server.ts`);
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
  }
  else
  {
    errmsg = 'not connected';
  }

  console.log(`errmsg:${errmsg} dirPath:${dirPath}`);
  return { errmsg, dirPath };
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
        // const xx = await ftp_site(conn, `namefmt ${conn.namefmt}`);

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
