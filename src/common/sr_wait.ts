// sr_wait.ts

// ------------------------------- iLockableResource -------------------------------
export interface iLockableResource 
{
  // name of the user who currently has the resource locked. When the resource is
  // unlocked, this name is cleared.
  userName: string;

  inUse: boolean;
  flag: boolean;
}

// ---------------------------------- sr_timeout ----------------------------------
export function sr_timeout( msec?:number ) : Promise<null>
{
  const promise = new Promise<null>( (resolve, reject ) =>
  {
    setTimeout(() =>
    {
      resolve( null ) ;
    }, msec || 1 ) ;
  }) ;

  return promise ;
}

// ----------------------------- lockableResource_new -----------------------------
export function lockableResource_new( )
{
  const resource : iLockableResource = {inUse:false, flag:false, userName:'' } ;
  return resource ;
}

// ------------------------- lockableResource_waitAndLock -------------------------
export async function lockableResource_waitAndLock( 
              resource: iLockableResource, userName:string, delay_msec?: number )
{
  while( true )
  {
    if ( !resource.inUse )
    {
      resource.inUse = true ;
      resource.userName = userName ;
      break ;
    }
    else 
    {
      // wait specified time.
      await sr_timeout(delay_msec);
    }
  }
}

// --------------------------- lockableResource_release ---------------------------
export function lockableResource_release( resource: iLockableResource )
{
  resource.inUse = false ;
  resource.userName = '' ;
}

// --------------------------------- waitUntilTrue ---------------------------------
export function waitUntilTrue( trueFunc : () => boolean, wait_msec: number ) : Promise<null>
{
  const promise = new Promise<null>( async (resolve, reject) =>
  {
    while(true)
    {
      // check that the condition waiting for is true.
      const rc = trueFunc( ) ;
      if ( rc )
      {
        resolve( null ) ;
        break ;
      }

      // wait specified time.
      await sr_timeout(wait_msec) ;
    }
  });
  return promise ;
}

// --------------------------------- waitAndLock ---------------------------------
// loop running trueFunc until it returns true.   Then call the lockFunc to lock
// a resource.
export function waitAndLock(trueFunc: () => boolean, lockFunc: () => void,
        wait_msec: number): Promise<null>
{
  const promise = new Promise<null>(async (resolve, reject) =>
  {
    while (true)
    {
      // check that the condition waiting for is true.
      const rc = trueFunc();
      if (rc)
      {
        lockFunc() ;
        resolve(null);
        break ;
      }

      // wait specified time.
      await sr_timeout(wait_msec);
    }
  });
  return promise;
}
