import {Lock, WaitNotify, Semaphore} from "./lock.js";


function assert(expected, actual, msg) {
    if (expected!==actual) {
        console.log(msg, expected + " vs. " + actual);
        throw new Error(msg + " - Expected: "+ expected + " vs. Actual: " + actual);
    }

}


let l1 = new Lock();
let sem = new Semaphore(10);

let cnt = 0;
let t1 = await l1.lock();
for(let i=0;i<20;i++) {
    (async () => {
        let n;
        try {
            n = await sem.acquire();
            cnt++;
            if(cnt%10===0) {
                l1.unlock(t1);
            }
            await new Promise(r => setTimeout(r, 10000));

        } finally {
            await sem.release(n);
        }
    })();
}
await new Promise( r=> setTimeout(r, 3000));
let t2 = await l1.lock();
assert(10, cnt, "cnt should be 10");
l1.unlock(t2);
await new Promise(r=> setTimeout(r,3000));
t1 = await l1.lock();
t2 = await  l1.lock();
assert(20, cnt, "cnt should be 20");



let lock_timeout = new Lock();

let token = await lock_timeout.lock();
let my_token;
let timeout_message = "oops";
try {
    my_token = await lock_timeout.lock_timeout(500);
    assert(false, true, "should not get here");
} catch(e) {
    timeout_message = e.message;
} finally {
    lock_timeout.unlock(my_token);  // this should not be allowed to unlock
}
assert("timed out", timeout_message, "wrong message");

lock_timeout.unlock(token);

try {
    token = await lock_timeout.lock_timeout(500);
} catch(e) {
    assert(false, true, "should not get here");
}
assert(token!==null, true, "should have a token");

let lock = new Lock();
let lock2 = new Lock();
let lock2_token = await lock2.lock();

let i = 0;
async function doit(n) {
    let token = await lock.lock();

    let f = i;
    await new Promise(r => setTimeout(r, Math.floor(Math.random()*500)));
    if(f!==i) {
        throw new Error("f not the same");
    }

    i++;
    if(i===99) {
        // console.log("unlock lock2");
        lock2.unlock(lock2_token);
    }
    // console.log("calling unlock: " + n);
    lock.unlock(token);
    // console.log("done with : " + n);
}

async function try_to_schedule(n) {
    await new Promise(r => setTimeout(r, Math.floor(Math.random()*1000)));
    doit(n);

}
for(let j=0;j<100;j++) {
    try_to_schedule(j);
}
lock2_token = await lock2.lock();
// console.log("all done");
assert(99, i, "values not correct");

if(true) {
    let foo_t = new WaitNotify();
    try {
        await foo_t.wait_timeout(1000);
        throw new Error("should not get here");
    } catch (e) {
        assert("timed out", e.message, "wrong message");
    }
}


if(true) {
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
                if(count===99) {
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


if(true) {
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
