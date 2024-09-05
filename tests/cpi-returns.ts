import * as anchor from "@coral-xyz/anchor";
import * as borsh from "borsh"
import assert from "assert";
import { Program } from "@coral-xyz/anchor";
import { Callee } from "../target/types/callee";
import { Caller } from "../target/types/caller";
import { ConfirmOptions } from "@solana/web3.js";

const { SystemProgram } = anchor.web3;


describe("cpi-returns", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const calleeProgram = anchor.workspace.Callee as Program;
  const callerProgram = anchor.workspace.Caller as Program;

  const getReturnLog = (confirmedTransaction) => {
    const prefix = "Program Return: ";
    let log = confirmedTransaction.meta.logMessages.find((log)=>{
      log.startsWith(prefix)
    })
    log = log.slice(prefix.length)
    const [key, data] = log.split(" ",2);
    const buffer = Buffer.from(data, "base64");
    return [key, data, buffer]
  }

  const cpiReturn = anchor.web3.Keypair.generate();
  const confirmOptions: ConfirmOptions = {
    commitment:"confirmed"
  }

  it("can initialize", async () =>{
    await calleeProgram.methods
    .initialize()
    .accounts({
      account: cpiReturn.publicKey,
      user: provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([cpiReturn])
    .rpc();
  })
});
