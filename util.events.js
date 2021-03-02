export default class Events {
    constructor() {
        this.events = new Map();
    }
    on(name, method, context) {
        return void this.events.set(name, context ? method.bind(context) : method);
    }
    emit(name, data) {
        return this.events.has(name)
            ? void this.events.get(name)(data)
            : void 0;
    }
    remove(name) {
        return void this.events.delete(name);
    }
}
