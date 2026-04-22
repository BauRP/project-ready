import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { IdentityProvider } from "@/contexts/IdentityContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { useEffect } from "react";
import Gun from "gun";

const queryClient = new QueryClient();

// Список ваших серверов (добавьте сюда остальные из ваших 30 узлов)
const peers = [
  'https://gun-manhattan.herokuapp.com/gun',
  'http://localhost:8765/gun'
];

const App = () => {
  useEffect(() => {
    // Инициализация GunDB при запуске приложения
    const gun = Gun({ peers });
    
    // Логика Бота: Слушаем входящие сообщения
    gun.get('trivo-chat-messages').map().once((data, id) => {
      if (data && data.text && data.sender !== 'TrivoBot') {
        // Простая логика ответа бота (можно усложнить завтра)
        if (data.text.toLowerCase().includes('привет')) {
          const msgId = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          gun.get('trivo-chat-messages').get(msgId).put({
            text: "Привет, Босс! Я на связи и готов к работе.",
            sender: "TrivoBot",
            timestamp: Date.now()
          });
        }
      }
    });

    console.log("Trivo Системы запущены: GunDB подключен.");
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LanguageProvider>
            <IdentityProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </TooltipProvider>
            </IdentityProvider>
          </LanguageProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
