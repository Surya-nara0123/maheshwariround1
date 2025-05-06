"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

// Message type definition
interface Message {
  type: 'user' | 'bot' | 'system' | 'error';
  content: string;
  timestamp: Date;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Connect to WebSocket server
  useEffect(() => {
    const connectWebSocket = () => {
      setIsConnecting(true);
      
      // Create WebSocket connection
      // Use correct host in production or development
      const wsHost = process.env.NEXT_PUBLIC_WS_HOST || 'ws://localhost:8080';
      const ws = new WebSocket(wsHost);
      
      ws.onopen = () => {
        console.log('Connected to WebSocket server');
        setIsConnected(true);
        setIsConnecting(false);
        setReconnectAttempt(0);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setMessages(prev => [...prev, {
            type: data.type,
            content: data.content,
            timestamp: new Date()
          }]);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('Disconnected from WebSocket server');
        setIsConnected(false);
        
        // Attempt to reconnect with exponential backoff
        setIsConnecting(true);
        const nextAttempt = Math.min(reconnectAttempt + 1, 5);
        setReconnectAttempt(nextAttempt);
        
        const timeout = Math.pow(2, nextAttempt) * 1000;
        console.log(`Reconnecting in ${timeout/1000} seconds...`);
        
        setTimeout(() => {
          connectWebSocket();
        }, timeout);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setMessages(prev => [...prev, {
          type: 'error',
          content: 'Connection error. Attempting to reconnect...',
          timestamp: new Date()
        }]);
      };
      
      wsRef.current = ws;
    };
    
    connectWebSocket();
    
    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [reconnectAttempt]);
  
  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Send message to WebSocket server
  const sendMessage = () => {
    if (!inputMessage.trim() || !isConnected) return;
    
    // Add message to chat
    setMessages(prev => [...prev, {
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    }]);
    
    // Send to WebSocket server
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        content: inputMessage
      }));
    }
    
    // Clear input
    setInputMessage('');
  };
  
  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">AI Chat Assistant</h1>
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-red-500'}`}></div>
            <span>{isConnected ? 'Connected' : (isConnecting ? 'Connecting...' : 'Disconnected')}</span>
          </div>
        </div>
      </header>
      
      {/* Chat container */}
      <div className="flex-1 overflow-auto p-4 container mx-auto max-w-4xl">
        <div className="space-y-4">
          {messages.length === 0 && !isConnecting && (
            <div className="text-center text-gray-500 py-10">
              <p>No messages yet. Start chatting below!</p>
            </div>
          )}
          
          {isConnecting && messages.length === 0 && (
            <div className="text-center text-gray-500 py-10">
              <p>Connecting to server...</p>
            </div>
          )}
          
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`p-3 rounded-lg max-w-3xl ${
                msg.type === 'user' 
                  ? 'bg-blue-100 ml-auto' 
                  : msg.type === 'error' 
                  ? 'bg-red-100' 
                  : msg.type === 'system' 
                  ? 'bg-gray-100 italic' 
                  : 'bg-white'
              }`}
            >
              <div className="flex items-center mb-1">
                <span className="font-semibold mr-2">
                  {msg.type === 'user' ? 'You' : 
                   msg.type === 'bot' ? 'Bot' : 
                   msg.type === 'system' ? 'System' : 'Error'}
                </span>
                <span className="text-xs text-gray-500">
                  {msg.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Command help section */}
      <div className="bg-gray-200 p-2 border-t border-gray-300">
        <div className="container mx-auto max-w-4xl text-sm text-gray-600">
          <p><strong>Commands:</strong> 
            <span className="ml-2 mr-4">/summarise [text]</span>
            <span>/translate-to-[language] [text]</span>
          </p>
        </div>
      </div>
      
      {/* Input area */}
      <div className="p-4 border-t border-gray-300 bg-white">
        <div className="container mx-auto max-w-4xl">
          <div className="flex space-x-2">
            <textarea 
              className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={isConnected ? "Type a message..." : "Connecting to server..."}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={!isConnected}
              rows={2}
            />
            <button 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:bg-gray-400"
              onClick={sendMessage}
              disabled={!isConnected || !inputMessage.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}