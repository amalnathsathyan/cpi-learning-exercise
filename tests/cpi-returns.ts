import * as anchor from "@coral-xyz/anchor";
import * as borsh from "borsh"
import assert from "assert";
import { Program } from "@coral-xyz/anchor";
import { Callee } from "../target/types/callee";
import { Caller } from "../target/types/caller";
import { ConfirmOptions, Connection, sendAndConfirmTransaction } from "@solana/web3.js";

const { SystemProgram } = anchor.web3;


describe("cpi-returns", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const calleeProgram = anchor.workspace.Callee as Program;
  const callerProgram = anchor.workspace.Caller as Program;

  const getReturnLog = async (confirmedTransaction) => {
    const prefix = "Program return:";
    const prefix2 = "Program data:"
    if (!confirmedTransaction?.meta?.logMessages || confirmedTransaction.meta.logMessages.length === 0) {
      throw new Error("No log found")

    }
    let log = confirmedTransaction.meta.logMessages.find((log) => {
      return log.startsWith(prefix) && log.includes(calleeProgram.programId.toBase58()) || log.startsWith(prefix2)
    })

    if(!log) {
      throw new Error("No log found after search")
    }

    log = log.slice(prefix.length).trim();
    // console.log({log})

    const [key, data] = log.split(" ", 2);

    if (!key || !data) {
      throw new Error("Invalid log format")
    }
    const buffer = Buffer.from(data, "base64");
    return [key, data, buffer]
  }

  const cpiReturn = anchor.web3.Keypair.generate();
  const confirmOptions: ConfirmOptions = {
    commitment: "confirmed"
  }

  it("can initialize", async () => {
    await calleeProgram.methods
      .initialize()
      .accounts({
        account: cpiReturn.publicKey,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([cpiReturn])
      .rpc(confirmOptions);
  })

  it("can return u64 through CPI", async () => {
    const tx = await callerProgram.methods
      .cpiCallReturnU64()
      .accounts({
        cpiReturn: cpiReturn.publicKey,
        cpiReturnProgram: calleeProgram.programId
      })
      .rpc(confirmOptions);

    // const currentBlockHash = await provider.connection.getLatestBlockhash()
    // const transactionResult = await provider.connection.confirmTransaction({
    //   blockhash: currentBlockHash.blockhash,
    //   lastValidBlockHeight: currentBlockHash.lastValidBlockHeight,
    //   signature:tx
    // })
    // console.log("TransactionHash: ", tx)
    // console.log("TransactionResult: ", transactionResult)
    const t = await provider.connection.getTransaction(tx, { maxSupportedTransactionVersion: 0, commitment: "confirmed" })
    // console.log('***T**', t)
    const [key, data, buffer] = await getReturnLog(t);
    assert.equal(key, calleeProgram.programId)



    //check matching log on reciver side

    // let receiveLog = t.meta.logMessages.find(
    //   (log) => log == `Program data: ${data}`
    // );


    let recieveLog = t.meta.logMessages.find(
      (log) => {
        if (log == `Program data: ${data}`) {
          return log
        }
      }
    )
    // console.log("Returned Log:", recieveLog)
    assert(recieveLog !== undefined)

    const reader = new borsh.BinaryReader(buffer);
    assert.equal(reader.readU64().toNumber(), 30);
  })

  it("can make a non-cpi call(direct call to callee) to a function that returns a u64", async () => {
    const tx = await calleeProgram.methods
    .returnU64()
    .accounts({
      account: cpiReturn.publicKey
    })
    .rpc(confirmOptions);
    const t = await provider.connection.getTransaction(tx, { maxSupportedTransactionVersion: 0, commitment: "confirmed" })
    const[key, ,buffer] = await getReturnLog(t)
    assert.equal(key, calleeProgram.programId);
    const reader = new borsh.BinaryReader(buffer);
    assert.equal(reader.readU64().toNumber(),30)
  })

  it ("can return a struct through a CPI", async () =>{
    const tx = await callerProgram.methods
    .cpiCallReturnStruct()
    .accounts({
      cpiReturn:cpiReturn.publicKey,
      cpiReturnProgram: calleeProgram.programId
    })
    .rpc(confirmOptions)
    const t = await provider.connection.getTransaction(tx,{
      commitment: "confirmed",
      maxSupportedTransactionVersion:0
    })

    const [key, data, buffer] = await getReturnLog(t);
    assert.equal(key, calleeProgram.programId);

    //on the reciving side

    const recieveLog = t.meta.logMessages.find(
      (log) => log == `Program data: ${data}`
    );

    assert (recieveLog !== undefined)

    class Assignable {
      constructor(properties) {
        Object.keys(properties).map((key)=>{
          this[key] = properties[key];
        })
      }
    }

    class Data extends Assignable {}
    const schema = new Map([
      [Data,{kind:"struct", fields:[["value","u64"]]}],
    ])
    const deserialized = borsh.deserialize(schema,Data,buffer);
    // @ts-ignore
    assert(deserialized.value.toNumber()=== 11)
  })

  it("can return a vec from a cpi", async () => {
    const tx = await callerProgram.methods
      .cpiCallReturnVec()
      .accounts({
        cpiReturn:cpiReturn.publicKey,
        cpiReturnProgram:calleeProgram.programId
      })
      .rpc(confirmOptions)

    let t = await provider.connection.getTransaction(tx,{
      commitment:"confirmed",
      maxSupportedTransactionVersion:0
    })

    const [key, data, buffer] = await getReturnLog(t);
    assert.equal(key, calleeProgram.programId);

    //check for matchimg  recieve side
    let receiveLog = t.meta.logMessages.find(
      (log)=>log == `Program data: ${data}`
    )

    assert(receiveLog !== undefined)

    

    const reader = new borsh.BinaryReader(buffer);

    /* //for unsigned numbers
    const array = reader.readArray(()=> reader.readU32())
    */
    const array = []
    let offset = reader.offset;
    const vecLength = reader.buf.readInt32LE(offset); // first 4  bytes gives the lengeth of the buffer
    offset += 4; //increase offset by 4 to start reading values

    if (offset + (vecLength * 4) > buffer.length) {
      throw new Error("Buffer overflow: Trying to read beyond buffer length.");
    }

    for(let i=0; i<vecLength; i++){
      const value = reader.buf.readInt32LE(offset);
      array.push(value);
      offset+=4;
    }
    assert.deepStrictEqual(array, [12,-46,32,87])
  })
  it("it sets a return value in the idl",async () => {
      const return64Instruction = calleeProgram.idl.instructions.find(
        (f)=>f.name == "returnU64"
      );
      assert.equal(return64Instruction.returns, "u64");
      const returnStructInstruction = calleeProgram.idl.instructions.find(
        (f) => f.name == "returnStruct"
      )
      assert.deepStrictEqual(returnStructInstruction.returns, {
        defined: {
          name: 'structReturn'
        }
      })
  })

  it("can return a u64 via view", async ()=>{
    //via methods API
    //@ts-expect-error
    assert(new anchor.BN(99).eq(await callerProgram.views.returnU64()))
    assert(new anchor.BN(99).eq(await callerProgram.methods.returnU64().view()));
    //alternatively
  })

  it("it can return a struct via view", async()=>{
    //@ts-expect-error
    const struct = await callerProgram.views.returnStruct();
    assert(struct.a.eq(new anchor.BN(1)))
    assert(struct.b.eq(new anchor.BN(2)))
    //via methods API
    const struct2 = await callerProgram.methods.returnStruct().view();
    assert(struct2.a.eq(new anchor.BN(1)))
    assert(struct2.b.eq(new anchor.BN(2)))
  })

  it("can return a vec via view", async ()=> {
    //@ts-expect-error
    const vec = await callerProgram.views.returnVec();
    assert(new anchor.BN(vec[0]).eq(new anchor.BN(1)));
    assert(new anchor.BN(vec[1]).eq(new anchor.BN(2)));
    assert(new anchor.BN(vec[2]).eq(new anchor.BN(3)));
    //via methods API
    const vec2 = await callerProgram.methods.returnVec().view();
    assert(new anchor.BN(vec2[0]).eq(new anchor.BN(1)));
    assert(new anchor.BN(vec2[1]).eq(new anchor.BN(2)));
    assert(new anchor.BN(vec2[2]).eq(new anchor.BN(3)));
  })

  it("can return a u64 from an caccount via view", async () =>{
    const value = new anchor.BN(10);
    assert(value.eq(
      await calleeProgram.methods.returnU64FromAccount()
      .accounts({account: cpiReturn.publicKey})
      .view()
    ))
  })
  it("can call view on mutable instruction", async () => {
    assert.equal(calleeProgram.views.initialize, undefined);
    try {
      await calleeProgram.methods
      .initialize()
      .accounts({
        account: cpiReturn.publicKey,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([cpiReturn])
      .view()
    } catch (e) {
      assert(e.message.includes("Method does not support views"))
    }
  })

});
