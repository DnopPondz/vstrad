"use client";

import React, { useEffect, useRef } from "react";
import { createChart, ColorType, CandlestickSeries } from "lightweight-charts";

interface TradingChartProps {
  onPriceChange?: (price: number) => void;
  symbol?: string;
}

export default function TradingChart({ onPriceChange, symbol = "BTCUSDT" }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 🛑 Mapping: ถ้าเลือกทอง (XAUUSD) ให้ดึงข้อมูล PAXGUSDT จาก Binance แทน
    const fetchSymbol = symbol === "XAUUSD" ? "PAXGUSDT" : symbol;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#000000" },
        textColor: "#C3C6CE",
      },
      grid: {
        vertLines: { color: "#1f1f1f" },
        horzLines: { color: "#1f1f1f" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    let socket: WebSocket;

    const initChart = async () => {
      try {
        const res = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${fetchSymbol.toUpperCase()}&interval=1m&limit=100`
        );
        const history = await res.json();
        const formattedHistory = history.map((d: any) => ({
          time: d[0] / 1000,
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
        }));
        candlestickSeries.setData(formattedHistory);

        const streamName = `${fetchSymbol.toLowerCase()}@kline_1m`;
        socket = new WebSocket(`wss://stream.binance.com:9443/ws/${streamName}`);

        socket.onmessage = (event) => {
          const message = JSON.parse(event.data);
          const candle = message.k;

          const updatedCandle = {
            time: candle.t / 1000,
            open: parseFloat(candle.o),
            high: parseFloat(candle.h),
            low: parseFloat(candle.l),
            close: parseFloat(candle.c),
          };

          candlestickSeries.update(updatedCandle);
          if (onPriceChange) onPriceChange(updatedCandle.close);
        };
      } catch (error) {
        console.error("Error connecting to Binance:", error);
      }
    };

    initChart();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      if (socket) socket.close();
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [symbol, onPriceChange]);

  return <div ref={chartContainerRef} className="w-full h-full relative" />;
}