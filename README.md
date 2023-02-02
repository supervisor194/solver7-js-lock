# solver7-js-lock
Simple lock and semaphore for Javascript when using async/await.  Built on top of a WaitNotify that includes timeout capability.
Timeouts may be used with the Lock and Semaphore classes as well.

Usage of Lock:
```
import * as lock from "./lock.js";

let my_lock = new lock.Lock();

let cnt = 0;
async function critical_code(i) {
    let token;
    try {
        token = await my_lock.lock();
        let current_cnt = cnt;
        console.log(i+ " is in critical code");
        await new Promise(r => setTimeout(r, Math.floor(Math.random()*5)));
        if(current_cnt!==cnt) {
            throw new Error("lock not working");
        }
        cnt++
    } finally {
        my_lock.unlock(token);
    }
}

async function schedule(i) {
    await new Promise(r => setTimeout(r, Math.floor(Math.random() * 5000)));
    await critical_code(i);  // don't use await in order to
}
for(let i=0;i<5000;i++) {
    schedule(i);
}

console.log("all added, should complete in about 12-15 seconds, Math.random()*5/2*5000/1000 ~ 12.5 seconds");
```
Usage of Semaphore:
```
import * as lock from "./lock.js";

let my_sem = new lock.Semaphore();

async function producer() {
    // build up work and release 1 token
    console.log("releasing");
    my_sem.release(1);
    console.log("released");
}

async function waiter() {
    let n;
    try {
        console.log("waiting for work");
        n = await my_sem.acquire();
        // do work
        console.log("did work");
    } finally {
        await my_sem.release(n);
    }
}

waiter();
producer();
```
Usage of Semaphore with multiple tokens and a consumer acting as a Sink.
```
import * as lock from "./lock.js";

let my_sem = new lock.Semaphore(10);

async function producer() {
    while(true) {
        // build up some work
        console.log("building 1 token");
        my_sem.release(1);
        console.log("built 1 token");
        await new Promise(r=> setTimeout(r, 250));
    }
}

async function consumer() {
    while(true) {
        console.log("waiting for 7 at least");
        let n = await my_sem.acquire(7, true);  // run if we have 7 or more, grabbing all available tokens
        console.log("ate: " + n);
    }
}

consumer();
producer();
```
Using the underlying WaitNotify:
```
import * as lock from "./lock.js";

let foo = new lock.WaitNotify();

async function waiter() {
    while(true) {
        try {
            console.log("waiting to be notified");
            await foo.wait_timeout(3000);   // wait up to 3 seconds
            console.log("was notified");
        } catch (e) {
            console.log(e.message);
        }
    }
}

async function writer(t) {
    await new Promise(p1 => setTimeout(p1, t));  // wait 5 seconds, then notify
    foo.notify();
}

waiter();
writer(2000);

writer(3000);
```
    
