
import { describe, expect, it } from "vitest";
import { Cl, cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const wallet1 = accounts.get('wallet_1')!;
const wallet2 = accounts.get('wallet_2')!;
const wallet3 = accounts.get('wallet_3')!;


describe("example tests", () => {
  it("ensures simnet is well initialised", () => {
    expect(simnet.blockHeight).toBeDefined();
  });
});

describe("Token coontract", () => {
  it("ensures the contract is deployed", () =>{
    const contractSource = simnet.getContractSource("Token");
    expect(contractSource).toBeDefined();
  });
});

describe("Mint token", () =>{
  it('allow wallet1 ro transfer to wallet2', () => {
    const transfer = simnet.callPublicFn('mint', [Cl.uint(1000000)], wallet2, wallet1);
    expect(transfer.result).toBeOk(Cl.bool(true));
  });
});

describe("transfer token", () =>{
  it('allow wallet1 ro transfer to wallet2', () => {
    const amount = 10000000;
    const transfer = simnet.callPublicFn('Token','transfer', [Cl.uint(amount)], wallet2, wallet3);
    expect(transfer.result).toBeOk(Cl.bool(true));
  });
});


