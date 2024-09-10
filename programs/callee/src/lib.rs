use anchor_lang::prelude::*;

declare_id!("BJYS8QEhSCk4pgtn6oArSEYNScMeTJmrNCVAzsEHaba3");

#[program]
pub mod callee {

    use super::*;

    #[derive(AnchorSerialize, AnchorDeserialize)]
    pub struct StructReturn {
        pub value: u64,
    }

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let account = &mut ctx.accounts.account;
        account.value = 10;
        Ok(())
    }

    pub fn return_u64(_ctx: Context<CpiReturn>) -> Result<u64> {
        Ok(30)
    }

    pub fn return_struct(_ctx:Context<CpiReturn>) -> Result<StructReturn>{
        let s = StructReturn {value: 11};
        Ok(s)
    }

    pub fn return_vec(_ctx:Context<CpiReturn>) -> Result<Vec<i32>> {
        Ok(vec![12,-46,32,87])
    }

    pub fn return_u64_from_account(ctx: Context<CpiReturn>) -> Result<u64> {
        let account = &ctx.accounts.account;
        Ok(account.value)
    }
}


#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8+8)]
    pub account: Account<'info, CpiReturnAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct CpiReturn<'info> {
    pub account: Account<'info, CpiReturnAccount>
}

#[account]
pub struct CpiReturnAccount {
    pub value: u64
}


