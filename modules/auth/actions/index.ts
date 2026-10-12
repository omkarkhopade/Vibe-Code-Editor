"use server";
import { auth } from "@/auth";
export async function currentUser() { return (await auth())?.user; }
