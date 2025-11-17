import React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function ContactUs() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#08080b] to-[#0b1020] py-12 px-4">
      <div className="w-full max-w-3xl mx-auto">
        <Card className="p-8">
          <h1 className="text-2xl font-bold mb-2 text-white">Contact Us</h1>
          <p className="text-gray-300 mb-6">Have a question or need support? Drop us a message and we'll get back to you at <strong>trollcity2025@gmail.com</strong>.</p>

          <form action={`mailto:trollcity2025@gmail.com`} method="post" encType="text/plain">
            <label className="block text-gray-300 text-sm mb-1">Your name</label>
            <Input name="name" className="mb-4" />

            <label className="block text-gray-300 text-sm mb-1">Your email</label>
            <Input name="email" className="mb-4" />

            <label className="block text-gray-300 text-sm mb-1">Message</label>
            <Textarea name="message" className="mb-4 h-36" />

            <div className="flex gap-3">
              <Button type="submit">Send</Button>
              <Button variant="ghost" type="reset">Reset</Button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
