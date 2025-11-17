import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Employment() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#08080b] to-[#0b1020] py-12 px-4">
      <div className="w-full max-w-4xl mx-auto">
        <Card className="p-8">
          <h1 className="text-3xl font-bold mb-4 text-white">Careers at Troll City</h1>
          <p className="text-gray-300 mb-6">
            We're growing. If you're excited about live experiences, community, and building new social features, we'd love to hear from you.
          </p>

          <h3 className="text-lg font-semibold text-white mt-4">Open Positions</h3>
          <ul className="list-disc list-inside text-gray-300 mb-6">
            <li>Frontend Engineer (React)</li>
            <li>Backend Engineer (Node / Supabase)</li>
            <li>Live Operations / Community Manager</li>
            <li>QA Engineer</li>
          </ul>

          <p className="text-gray-300 mb-6">To apply, please email your resume and a short note to <strong>trollcity2025@gmail.com</strong>.</p>

          <div className="flex gap-3">
            <Button asChild>
              <a href="mailto:trollcity2025@gmail.com">Email Us</a>
            </Button>
            <Button variant="ghost" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back to top</Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
