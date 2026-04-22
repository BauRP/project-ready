declare module "gun" {
  interface GunInstance {
    get(key: string): GunInstance;
    put(data: any): GunInstance;
    on(callback: (data: any, key: string) => void): GunInstance;
    once(callback: (data: any, key: string) => void): GunInstance;
    map(): GunInstance;
  }

  interface GunConstructor {
    new (options?: any): GunInstance;
    (options?: any): GunInstance;
  }

  const Gun: GunConstructor;
  export default Gun;
}

declare module "gun/sea" {}
