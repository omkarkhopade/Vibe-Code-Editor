
import React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Globe, GitBranch } from "lucide-react";
import { signIn } from "@/auth";

async function handleGoogleSignIn(){
"use server"
await signIn("google")
}

async function handleGithubSignIn(){
"use server"
await signIn("github")
}

const SignInFormClient = () => {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          Sign In
        </CardTitle>
        <CardDescription className="text-center">
          Choose your preferred sign-in method
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4">
        <form action={handleGoogleSignIn}>
          <Button type="submit" variant={"outline"} className="w-full">
            <Globe className="mr-2 h-4 w-4" />
            <span>Sign in with google</span>
          </Button>
        </form>
        <form action={handleGithubSignIn}>
          <Button type="submit" variant={"outline"} className="w-full">
            <GitBranch className="mr-2 h-4 w-4" />
            <span>Sign in with github</span>
          </Button>
        </form>
      </CardContent>

      <CardFooter>
        <p className="text-sm text-center text-gray-500 dark:text-gray-400 w-full">
          Read the{" "}
          <a href="/docs" className="underline hover:text-primary">
            editor guide
          </a>{" "}
          for information about projects, GitHub imports and AI assistance.
        </p>
      </CardFooter>
    </Card>
  );
};

export default SignInFormClient;


