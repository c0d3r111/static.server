import dgram from 'dgram';

export default class Intranet {
    constructor(config) {
        this.port      = config.port;
        this.receiver  = config.receiver;
        this.mediator  = config.mediator;
        this.localhost = 'localhost';
        this.net       = dgram.createSocket('udp4');

        this.receiver
            ? void this.respond()
            : void this.process();

        void this.bind();
        void this.error();
    }
    bind() {
        return void this.net.bind({
          address   : this.localhost,
          port      : this.port,
          exclusive : true
        });
    }
    error() {
        return void this.net.on('error', () => {
            void this.net.close();
        });
    }
    process() {
        return void this.net.on('message', data => {
            return void this.mediator(this.parse(data.toString()));
        });
    }
    parse(data) {
        try {
            return JSON.parse(data);
        }
        catch {
            return Object.create(null);
        }
    }
    respond() {
        return void this.net.on('message', async data => {
            return void this.net.send(
                await this.mediator(this.parse(data.toString())),
                      this.receiver,
                      this.localhost
            );
        });
    }
    send(message, port) {
        return void this.net.send(message, port, this.localhost);
    }
    setmediator(method) {
        return void (this.mediator = method);
    }
}
