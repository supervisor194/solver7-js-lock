import {Lock, WaitNotify, Semaphore} from "./lock.js";

let fsem = new Semaphore(20);

let cnt = 0;

for(let i=0;i<10000;i++) {
    (async ()=> {
        let token = await fsem.acquire();

        cnt++;

        await fsem.release(token);
    })();
}

await new Promise(r=> setTimeout(r, 10000));

function assert(expected, actual, msg) {
    if (expected !== actual) {
        console.log(msg, expected + " vs. " + actual);
        throw new Error(msg + " - Expected: " + expected + " vs. Actual: " + actual);
    }

}


let N = 10000;
let p1_p2_sem = new Semaphore(0);
let p1 = (async ()=> {
    for(let i=0;i<N;i++) {
        p1_p2_sem.release(1);
        await new Promise(r=> setTimeout(r, 2));
    }
});
let sum = 0;
let loop_cnt = 0;
let wait_sem = new Semaphore(0);
let p2 = (async ()=> {
    while(true) {
        loop_cnt++;
        let n = await p1_p2_sem.acquire(1, true);
        sum+=n;
        if(sum>=N) {
            wait_sem.release(1);
            return;
        }
        await new Promise(r=> setTimeout(r, 3000));
        console.log(n);
    }
});
p2();
p1();
await wait_sem.acquire();
assert(N, sum, "wrong sum");
assert(true, loop_cnt<15, "too many loops");
console.log("sum : " + sum);
console.log("loops: " + loop_cnt);

let l1 = new Lock();
let sem = new Semaphore(10);

cnt = 0;
let t1 = await l1.lock();
for (let i = 0; i < 20; i++) {
    (async () => {
        let n;
        try {
            n = await sem.acquire();
            cnt++;
            if (cnt % 10 === 0) {
                l1.unlock(t1);
            }
            await new Promise(r => setTimeout(r, 10000));

        } finally {
            await sem.release(n);
        }
    })();
}
await new Promise(r => setTimeout(r, 3000));
let t2 = await l1.lock();
assert(10, cnt, "cnt should be 10");
l1.unlock(t2);
await new Promise(r => setTimeout(r, 3000));
t1 = await l1.lock();
t2 = await l1.lock();
assert(20, cnt, "cnt should be 20");


let lock_timeout = new Lock();

let token = await lock_timeout.lock();
let my_token;
let timeout_message = "oops";
try {
    my_token = await lock_timeout.lock_timeout(500);
    assert(false, true, "should not get here");
} catch (e) {
    timeout_message = e.message;
} finally {
    lock_timeout.unlock(my_token);  // this should not be allowed to unlock
}
assert("timed out", timeout_message, "wrong message");

lock_timeout.unlock(token);

try {
    token = await lock_timeout.lock_timeout(500);
} catch (e) {
    assert(false, true, "should not get here");
}
assert(token !== null, true, "should have a token");

let lock = new Lock();
let lock2 = new Lock();
let lock2_token = await lock2.lock();

let i = 0;

async function doit(n) {
    let token = await lock.lock();

    let f = i;
    await new Promise(r => setTimeout(r, Math.floor(Math.random() * 500)));
    if (f !== i) {
        throw new Error("f not the same");
    }

    i++;
    if (i === 99) {
        // console.log("unlock lock2");
        lock2.unlock(lock2_token);
    }
    // console.log("calling unlock: " + n);
    lock.unlock(token);
    // console.log("done with : " + n);
}

async function try_to_schedule(n) {
    await new Promise(r => setTimeout(r, Math.floor(Math.random() * 1000)));
    doit(n);

}

for (let j = 0; j < 100; j++) {
    try_to_schedule(j);
}
lock2_token = await lock2.lock();
// console.log("all done");
assert(99, i, "values not correct");

if (true) {
    let foo_t = new WaitNotify();
    try {
        await foo_t.wait_timeout(1000);
        throw new Error("should not get here");
    } catch (e) {
        assert("timed out", e.message, "wrong message");
    }
}


if (true) {
    let lock3 = new Lock();
    let lock3_token = await lock3.lock();

    let count = 0;
    lock = new Lock();

    for (let j = 0; j < 100; j++) {
        (async () => {
            await new Promise(r => setTimeout(r, Math.floor(Math.random() * 3000)));
            let f = async () => {
                let x = count;
                await new Promise(r2 => setTimeout(r2, Math.floor(Math.random() * 20)));
                if (x !== count) {
                    throw new Error("bad");
                }
                count++;
                if (count === 99) {
                    // console.log("done with runExclusive");
                    lock3.unlock(lock3_token);
                }
            }
            lock.runExclusive(f);
        })();
    }
    // console.log("waiting on runExlusive tasks");
    await lock3.lock();
}


if (true) {
    let final_foo = new WaitNotify();
    (async () => {
        await new Promise(r2 => setTimeout(r2, 1000));
        console.log("doing notify of final_Foo");
        final_foo.notify();
    })();

    try {
        console.log("waiting for final_foo");
        await final_foo.wait_timeout(2000);
        console.log("done waiting on final_foo.");
    } catch (e) {
        throw new Error("should not get here: " + e.message);
    }

}


if (true) {
    let sem0 = new Semaphore(1);
    let outter_n = await sem0.acquire();
    let outs = [];
    outs.push("outter acquired");
    (async () => {
        outs.push("inner do acquire");
        sem0.acquire().then(async (n) => {
            outs.push("inner we got: " + n + " working for 2 seconds before release");
            await new Promise(r => setTimeout(r, 2000));
            outs.push("inner doing release");
            await sem0.release(n);
            outs.push("inner released");
        });
    })();

    await new Promise(r => setTimeout(r, 1000));
    outs.push("outter releasing");
    await sem0.release(outter_n);
    await new Promise(r => setTimeout(r, 1000));
    outs.push("outter trying to acquire again");
    await sem0.acquire();
    outs.push("outter got it");

    let expected = "outter acquired,inner do acquire,outter releasing,inner we got: 1 working for 2 seconds before release,outter trying to acquire again,inner doing release,inner released,outter got it";
    let actual = outs.join();

    assert(expected, actual, "values don't match");
}