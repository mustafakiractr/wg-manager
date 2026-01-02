/**
 * TrafficChart Component
 * Chart.js'i izole eder ve DOM cleanup sorununu çözer
 */
import { useEffect, useRef, memo } from 'react'
import { Line } from 'react-chartjs-2'

const TrafficChart = memo(({ data, options }) => {
  const chartRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    // Component unmount olduğunda cleanup
    return () => {
      if (chartRef.current) {
        try {
          // Chart instance'ı manuel olarak destroy et
          const chartInstance = chartRef.current
          if (chartInstance && typeof chartInstance.destroy === 'function') {
            chartInstance.destroy()
          }
        } catch (error) {
          // Hata sessizce yoksayılır (zaten destroy edilmiş olabilir)
          console.debug('Chart cleanup:', error.message)
        }
      }
    }
  }, [])

  // NOT: Data değişiminde cleanup yapma - DOM conflict yaratıyor
  // Key prop değişimi zaten yeni instance oluşturacak

  return (
    <div ref={containerRef} className="h-96 relative">
      <Line 
        ref={chartRef}
        data={data} 
        options={options}
      />
    </div>
  )
})

TrafficChart.displayName = 'TrafficChart'

export default TrafficChart
