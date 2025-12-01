import { Navigation } from "@/components/Navigation";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";

const Home = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <Hero />
      <Features />
    </div>
  );
};

export default Home;
