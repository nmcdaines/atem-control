import { Injectable } from '@nestjs/common';
import { promises } from 'dns';
// import find from 'local-devices';
// import oui from 'oui';



import { default as arp, IArpTableRow } from '@network-utils/arp-lookup';

import arpscan = require('arpscan/promise');

interface IArpObject {
  ip: string;
  mac: string;
  timestamp: string;
}

@Injectable()
export class NetworkService {
  async discover() {
    return new Promise<any>((resolve, reject) => {
        arpscan()
            .then(resolve)
            .catch(reject);
    });

    // return await arp.getTable()
  }

  private isBlackMagic(row: IArpTableRow) {
    if (!row) { return false; }
    return row.vendor === 'Blackmagic Design';
  }

  async discoverBlackMagic() {
    const lanDevices = await this.discover();
    const blackMagicDevices = lanDevices.filter(this.isBlackMagic);
    return blackMagicDevices;
  }
}
