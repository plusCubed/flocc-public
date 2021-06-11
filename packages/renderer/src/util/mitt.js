import mitt from 'mitt';

export class Mitt {
  constructor(e) {
    Object.assign(this, mitt(e));
  }
}
