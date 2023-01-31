export class WaitNotify {
    constructor() {
        this.resolve = null;
        this.reject = null;
        this._p = null;
    }

    wait() {
        this._p = new Promise((resolve, reject) => {
            this.resolve = resolve
        });
        this._p.then((v) => { /* console.log("resolved with: " + v)*/
        });
        return this._p;
    }

    wait_timeout(t) {
        const awaitTimeout = (timeout, reason) =>
            new Promise((resolve, reject) => {
                setTimeout(() => (reason === undefined ? resolve() : reject(reason)), timeout);
            });
        const execute = (promise, timeout, reason) =>
            Promise.race([promise, awaitTimeout(timeout, reason)]);

        let p = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject
        });
        p.then((v) => { /*console.log("resolved with: " + v)*/
        })
            .catch((e) => { /* console.log("rejecting with: " + e); */
                this.reject(e)
            });

        return execute(p, t, {message: "timed out"});
    }

    async notify(msg) {
        if (this.resolve) {
            this.resolve(msg);
        }
    }

}


class Node {

    constructor(val, next) {
        this.val = val;
        this.next = next;
    }

}

class Queue {

    constructor() {
        this.head = null;
        this.tail = null;
    }

    put(val) {
        let node = new Node(val, null);
        if (this.tail) {
            this.tail.next = node;
        } else {
            this.head = node;
        }
        this.tail = node;
    }


    take() {
        let node = this.head;
        if (node != null) {
            this.head = node.next;
        } else {
            throw new Error("no remaining nodes");
        }
        return node.val;
    }

}

class Tokens {
    constructor(n) {
        this.queue = new Queue();
        for (let i = 0; i < n; i++) {
            this.queue.put(i);
        }
    }

    next() {
        return this.queue.take();
    }

    free(token) {
        this.queue.put(token);
    }

}

export class Lock {

    constructor() {
        this.locked = -1;
        this.waiters = [];
        this.tokens = new Tokens(100000);
    }

    async runExclusive(to_run, timeout = null) {
        // console.log("doing runExclusive");
        let token;
        try {
            if (timeout !== null) {
                token = await this.lock_timeout(timeout);
            } else {
                token = await this.lock();
            }
            await to_run();
        } finally {
            // console.log("unlocking token: " + token);
            this.unlock(token);
        }
    }

    async lock() {
        if (this.locked === -1 && this.waiters.length === 0) {
            this.locked = this.tokens.next();
            return this.locked;
        }
        // get a foo from list
        let waiter = new WaitNotify();
        this.waiters.push(waiter);
        await waiter.wait();
        if (this.locked !== -1) {
            throw new Error("locked should be -1");
        }
        this.waiters.shift();
        this.locked = this.tokens.next();
        return this.locked;
    }

    async lock_timeout(t) {
        if (this.locked === -1 && this.waiters.length === 0) {
            this.locked = this.tokens.next();
            return this.locked;
        }
        let waiter = new WaitNotify();
        this.waiters.push(waiter);
        try {
            await waiter.wait_timeout(t);
        } catch (e) {
            // console.log(e.message + " : can't lock...");
            let i = this.waiters.indexOf(waiter);
            this.waiters.splice(i, 1);
            throw e;
        }
        if (this.locked !== -1) {
            throw new Error("locked should be =1");
        }
        this.waiters.shift();
        this.locked = this.tokens.next();
        return this.locked;
    }


    unlock(token) {
        if (this.locked !== token) {
            // console.log("unlock does nothing");
            return;
        }
        this.tokens.free(token);
        this.locked = -1;
        let waiter;
        if ((waiter = this.waiters[0])) {
            waiter.notify("unlock");
        }

    }
}


export class Semaphore {

    constructor(n = 1) {
        this.available = n;
        this.the_lock = new Lock();
        this.waiters = [];
    }


    async acquire_all() {
        let lock_token;
        let waiter;
        while (true) {
            try {
                lock_token = await this.the_lock.lock();
                if (this.available) {
                    let n = this.available;
                    this.available = 0;
                    return n;
                }
                waiter = new WaitNotify();
                this.waiters.push(waiter);
            } finally {
                this.the_lock.unlock(lock_token);
            }
            try {
                await waiter.wait();
            } catch (e) {
                console.error(e.message);
                let i = this.waiters.indexOf(waiter);
                this.waiters.splice(i, 1);
                throw e;
            }
        }
    }

    async acquire(n = 1, all = false) {
        let lock_token;
        let waiter;
        while (true) {
            try {
                lock_token = await this.the_lock.lock();
                if (this.available > n - 1) {
                    let a = all ? this.available : n;
                    this.available -= a;
                    return a;
                }
                waiter = new WaitNotify();
                this.waiters.push(waiter);
            } finally {
                this.the_lock.unlock(lock_token);
            }
            try {
                await waiter.wait();
            } catch (e) {
                console.log(e.message);
                let i = this.waiters.indexOf(waiter);
                this.waiters.splice(i, 1);
                throw e;
            }
        }

    }

    async release(n = 1) {
        if (!n) {
            return;
        }
        let lock_token;
        try {
            lock_token = await this.the_lock.lock();
            this.available += n;

            if (this.waiters.length > 0) {
                let waiter = this.waiters.shift();
                waiter.notify("unlock");
            }

        } finally {
            this.the_lock.unlock(lock_token);
        }
    }

    cnt() {
        return this.available;
    }
}
