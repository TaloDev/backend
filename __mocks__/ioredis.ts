import fs from 'fs/promises'

interface CacheItem {
  key: string
  value: string | number
  extra: (string | number)[]
}

export class RedisMock {
  filepath = 'tests/cache.json'

  async _init(): Promise<void> {
    await this._write([])
  }

  async _read(): Promise<CacheItem[]> {
    const content = await fs.readFile(this.filepath, 'utf-8')
    return JSON.parse(content)
  }

  async _write(data: CacheItem[]): Promise<void> {
    await fs.writeFile(this.filepath, JSON.stringify(data))
  }
}

export default class Redis extends RedisMock {
  async get(key: string): Promise<string | number> {
    const data = await this._read()
    return data.find((item) => item.key === key)?.value
  }

  async set(key: string, value: string | number, ...extra: (string | number)[]): Promise<void> {
    const data = await this.del(key)
    data.push({
      key,
      value,
      extra
    })

    await this._write(data)
  }

  async del(key: string): Promise<CacheItem[]> {
    let data = await this._read()
    data = data.filter((item) => item.key !== key)
    await this._write(data)

    return data
  }
}
