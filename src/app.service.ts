import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getHello() {
    return "CôteCar API running";
  }
}
