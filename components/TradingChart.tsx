"use client";

import React, { useEffect, useRef } from "react";
import { createChart, ColorType, CandlestickSeries } from "lightweight-charts";

interface TradingChartProps {
  onPriceChange?: (price: number) => void;
}

export default function TradingChart({ onPriceChange }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 1. สร้างตัวกราฟ
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#1e1e24" },
        textColor: "#C3C6CE",
      },
      grid: {
        vertLines: { color: "#2B2B43" },
        horzLines: { color: "#2B2B43" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    // 2. สร้างซีรีส์แท่งเทียน
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    let intervalId: NodeJS.Timeout;

    // 3. ฟังก์ชันดึงข้อมูลกราฟจริง (Replay Engine)
    const fetchRealData = async () => {
      try {
        // ดึงกราฟ BTCUSDT ย้อนหลังแบบ 1 นาที จำนวน 200 แท่ง จาก Binance API
        const res = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=200");
        const data = await res.json();

        // แปลงข้อมูลให้อยู่ในรูปแบบที่ lightweight-charts ต้องการ
        const formattedData = data.map((d: any) => ({
          time: d[0] / 1000, // เวลา (Binance ส่งมาเป็น Millisecond ต้องหาร 1000)
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
        }));

        // แบ่งข้อมูลเป็น 2 ส่วน
        const historyData = formattedData.slice(0, 100); // อดีต: 100 แท่งแรก
        const futureData = formattedData.slice(100);     // อนาคต: 100 แท่งหลังเอาไว้ Replay

        // วาดกราฟอดีตลงไปบนจอ
        candlestickSeries.setData(historyData);

        // ส่งราคาปิดล่าสุดไปให้ UI หน้าหลัก (เช่น ราคาแถวๆ 60,000+)
        let currentClose = historyData[historyData.length - 1].close;
        if (onPriceChange) onPriceChange(currentClose);

        // 4. เริ่มระบบ Replay: ปล่อยกราฟอนาคตทีละแท่ง
        let currentIndex = 0;
        intervalId = setInterval(() => {
          if (currentIndex < futureData.length) {
            const nextCandle = futureData[currentIndex];
            
            // อัปเดตกราฟแท่งใหม่เข้าไป
            candlestickSeries.update(nextCandle);
            
            // อัปเดตราคาล่าสุดส่งไปหน้า Dashboard ทันที
            if (onPriceChange) onPriceChange(nextCandle.close);
            
            currentIndex++;
          } else {
            // ถ้ารันกราฟหมด 100 แท่งแล้ว ให้หยุด (จบเกม)
            clearInterval(intervalId);
          }
        }, 1000); // ปล่อยแท่งใหม่ทุกๆ 1 วินาที (ในอนาคตปรับให้เร็วขึ้นได้ถ้าอยากให้กดดัน)

      } catch (error) {
        console.error("Error fetching chart data:", error);
      }
    };

    // เรียกใช้ฟังก์ชันดึงข้อมูล
    fetchRealData();

    // ปรับขนาดกราฟเวลากดย่อ/ขยายหน้าต่าง
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    // ทำความสะอาดเวลาปิดหน้าเว็บ
    return () => {
      clearInterval(intervalId);
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  return <div ref={chartContainerRef} className="w-full h-full rounded-lg overflow-hidden border border-gray-800" />;
}